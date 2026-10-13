import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, type NextResponse } from "next/server";
import { SANITY_SIGNATURE_HEADER, sanitySignature } from "@/lib/request-auth";

const {
    revalidateTagMock,
    afterMock,
    warmBlogCacheMock,
    warmProfileCacheMock,
    warmProjectCacheMock,
} = vi.hoisted(() => ({
    revalidateTagMock: vi.fn(),
    afterMock: vi.fn(),
    warmBlogCacheMock: vi.fn(),
    warmProfileCacheMock: vi.fn(),
    warmProjectCacheMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidateTag: revalidateTagMock }));
vi.mock("next/server", async (importOriginal) => ({
    ...(await importOriginal<typeof import("next/server")>()),
    after: afterMock,
}));
vi.mock("@/actions/warmCache", () => ({
    warmBlogCache: warmBlogCacheMock,
    warmProfileCache: warmProfileCacheMock,
    warmProjectCache: warmProjectCacheMock,
}));

const SECRET = "test-webhook-secret";

/** A delivery as Sanity sends it: the body, signed with the secret. */
function request(
    body: unknown = { _type: "profile" },
    {
        secret = SECRET,
        signature,
    }: { secret?: string; signature?: string } = {},
) {
    const raw = typeof body === "string" ? body : JSON.stringify(body);
    return new NextRequest("https://example.com/api/revalidate", {
        method: "POST",
        headers: {
            [SANITY_SIGNATURE_HEADER]:
                signature ?? sanitySignature(raw, Date.now(), secret),
        },
        body: raw,
    });
}

async function importPost() {
    const { POST } = await import("@/app/api/revalidate/route");
    // The route waits for Content Lake before it revalidates.
    return async (req: NextRequest): Promise<NextResponse | Response> => {
        const pending = POST(req);
        await vi.advanceTimersByTimeAsync(3000);
        return pending;
    };
}

beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    vi.stubEnv("SANITY_REVALIDATE_SECRET", SECRET);
    const result = { pages: { warmed: [], failed: [] } };
    warmBlogCacheMock.mockResolvedValue(result);
    warmProfileCacheMock.mockResolvedValue(result);
    warmProjectCacheMock.mockResolvedValue(result);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe("POST /api/revalidate", () => {
    it("rejects an unconfigured webhook without invalidating or warming", async () => {
        vi.stubEnv("SANITY_REVALIDATE_SECRET", "");
        const POST = await importPost();

        const response = await POST(request());

        expect(response.status).toBe(404);
        expect(revalidateTagMock).not.toHaveBeenCalled();
        expect(afterMock).not.toHaveBeenCalled();
    });

    it("rejects a secret of spaces alone, even signed with an empty key", async () => {
        vi.stubEnv("SANITY_REVALIDATE_SECRET", "   ");
        const POST = await importPost();

        // What anybody can sign: an HMAC under the empty key the blank
        // secret trims to.
        const response = await POST(request(undefined, { secret: "" }));

        expect(response.status).toBe(404);
        expect(revalidateTagMock).not.toHaveBeenCalled();
        expect(afterMock).not.toHaveBeenCalled();
    });

    it("trims the configured secret as Sanity's toolkit does", async () => {
        vi.stubEnv("SANITY_REVALIDATE_SECRET", ` ${SECRET}\n`);
        const POST = await importPost();

        const response = await POST(request());

        expect(response.status).toBe(200);
    });

    it("rejects a missing or invalid signature without invalidating or warming", async () => {
        const POST = await importPost();
        const body = JSON.stringify({ _type: "profile" });
        const valid = sanitySignature(body, Date.now(), SECRET);

        for (const signature of [
            "",
            "not a signature",
            sanitySignature(body, Date.now(), "another-secret"),
            // The right HMAC for another body.
            sanitySignature('{"_type":"post"}', Date.now(), SECRET),
            `${valid.slice(0, -1)}x`,
        ]) {
            const response = await POST(request(body, { signature }));
            expect(response.status, signature).toBe(404);
        }
        expect(revalidateTagMock).not.toHaveBeenCalled();
        expect(afterMock).not.toHaveBeenCalled();
    });

    it("answers a signed body that is not a document with 400", async () => {
        const POST = await importPost();

        for (const body of ["not json", "{}", '{"_type":""}', "[]"]) {
            const response = await POST(request(body));
            expect(response.status, body).toBe(400);
        }
        expect(revalidateTagMock).not.toHaveBeenCalled();
    });

    it("revalidates on the type alone when the slug comes in another shape", async () => {
        const POST = await importPost();

        const response = await POST(request({ _type: "post", slug: "a-note" }));

        expect(response.status).toBe(200);
        expect(revalidateTagMock).toHaveBeenCalledExactlyOnceWith(
            "post",
            "max",
        );
    });

    it("answers a thrown error with 500, not 404", async () => {
        revalidateTagMock.mockImplementation(() => {
            throw new Error("cache unavailable");
        });
        const POST = await importPost();

        const response = await POST(request());

        expect(response.status).toBe(500);
        expect(afterMock).not.toHaveBeenCalled();
    });

    it("schedules profile warming after accepting the authenticated mutation", async () => {
        const POST = await importPost();

        const response = await POST(request());

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            revalidated: true,
            warming: "scheduled",
        });
        expect(revalidateTagMock).toHaveBeenCalledExactlyOnceWith(
            "profile",
            "max",
        );
        expect(afterMock).toHaveBeenCalledTimes(1);
        expect(warmProfileCacheMock).not.toHaveBeenCalled();
        await afterMock.mock.calls[0][0]();
        expect(warmProfileCacheMock).toHaveBeenCalledTimes(1);
        expect(warmBlogCacheMock).not.toHaveBeenCalled();
    });

    it("preserves post invalidation and the existing post warming path", async () => {
        const POST = await importPost();

        const response = await POST(
            request({ _type: "post", slug: { current: "a-note" } }),
        );

        expect(await response.json()).toMatchObject({
            revalidated: true,
            message: "Revalidated post (a-note)",
            warming: "scheduled",
        });
        expect(revalidateTagMock).toHaveBeenCalledExactlyOnceWith(
            "post",
            "max",
        );
        await afterMock.mock.calls[0][0]();
        expect(warmBlogCacheMock).toHaveBeenCalledTimes(1);
        expect(warmProfileCacheMock).not.toHaveBeenCalled();
    });

    it("revalidates the project tag and schedules the project warmer", async () => {
        const POST = await importPost();

        const response = await POST(
            request({ _type: "project", slug: { current: "homelab" } }),
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            revalidated: true,
            warming: "scheduled",
        });
        expect(revalidateTagMock).toHaveBeenCalledExactlyOnceWith(
            "project",
            "max",
        );
        expect(afterMock).toHaveBeenCalledTimes(1);
        expect(warmProjectCacheMock).not.toHaveBeenCalled();
        await afterMock.mock.calls[0][0]();
        expect(warmProjectCacheMock).toHaveBeenCalledTimes(1);
        expect(warmBlogCacheMock).not.toHaveBeenCalled();
        expect(warmProfileCacheMock).not.toHaveBeenCalled();
    });

    it("contains project warming failures after the tag is revalidated", async () => {
        warmProjectCacheMock.mockRejectedValue(new Error("warming failed"));
        const POST = await importPost();

        const response = await POST(request({ _type: "project" }));

        expect(response.status).toBe(200);
        await expect(afterMock.mock.calls[0][0]()).resolves.toBeUndefined();
        expect(console.error).toHaveBeenCalledWith(
            "[Revalidate] Project cache warming failed:",
            expect.any(Error),
        );
    });

    it("acknowledges other document types without invalidating or warming", async () => {
        const POST = await importPost();

        // An asset or a system document reaches the hook when its filter is
        // wider than the three types: delivered, so not a failure.
        for (const _type of ["sanity.imageAsset", "system.group"]) {
            const response = await POST(request({ _type }));
            expect(response.status, _type).toBe(200);
            expect(await response.json()).toEqual({
                revalidated: false,
                ignored: true,
            });
        }
        expect(revalidateTagMock).not.toHaveBeenCalled();
        expect(afterMock).not.toHaveBeenCalled();
    });

    it("contains after-response warming failures after successful invalidation", async () => {
        warmProfileCacheMock.mockRejectedValue(new Error("warming failed"));
        const POST = await importPost();

        const response = await POST(request());

        expect(response.status).toBe(200);
        await expect(afterMock.mock.calls[0][0]()).resolves.toBeUndefined();
        expect(console.error).toHaveBeenCalledWith(
            "[Revalidate] Profile cache warming failed:",
            expect.any(Error),
        );
    });
});
