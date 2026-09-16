import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
    parseBodyMock,
    revalidateTagMock,
    afterMock,
    warmBlogCacheMock,
    warmProfileCacheMock,
} = vi.hoisted(() => ({
    parseBodyMock: vi.fn(),
    revalidateTagMock: vi.fn(),
    afterMock: vi.fn(),
    warmBlogCacheMock: vi.fn(),
    warmProfileCacheMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidateTag: revalidateTagMock }));
vi.mock("next/server", async (importOriginal) => ({
    ...(await importOriginal<typeof import("next/server")>()),
    after: afterMock,
}));
vi.mock("next-sanity/webhook", () => ({ parseBody: parseBodyMock }));
vi.mock("@/actions/warmCache", () => ({
    warmBlogCache: warmBlogCacheMock,
    warmProfileCache: warmProfileCacheMock,
}));

function request() {
    return new NextRequest("https://example.com/api/revalidate", {
        method: "POST",
        body: JSON.stringify({ _type: "profile" }),
    });
}

async function importPost() {
    return (await import("@/app/api/revalidate/route")).POST;
}

beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.stubEnv("SANITY_REVALIDATE_SECRET", "test-webhook-secret");
    parseBodyMock.mockResolvedValue({
        isValidSignature: true,
        body: { _type: "profile" },
    });
    const result = { pages: { warmed: [], failed: [] } };
    warmBlogCacheMock.mockResolvedValue(result);
    warmProfileCacheMock.mockResolvedValue(result);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe("POST /api/revalidate", () => {
    it("rejects an unconfigured webhook without invalidating or warming", async () => {
        vi.stubEnv("SANITY_REVALIDATE_SECRET", "");
        const POST = await importPost();

        const response = await POST(request());

        expect(response.status).toBe(404);
        expect(parseBodyMock).not.toHaveBeenCalled();
        expect(revalidateTagMock).not.toHaveBeenCalled();
        expect(afterMock).not.toHaveBeenCalled();
    });

    it("rejects an invalid signature without invalidating or warming", async () => {
        parseBodyMock.mockResolvedValue({
            isValidSignature: false,
            body: { _type: "profile" },
        });
        const POST = await importPost();

        const response = await POST(request());

        expect(response.status).toBe(404);
        expect(revalidateTagMock).not.toHaveBeenCalled();
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
        parseBodyMock.mockResolvedValue({
            isValidSignature: true,
            body: { _type: "post", slug: { current: "a-note" } },
        });
        const POST = await importPost();

        const response = await POST(request());

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

    it("keeps project changes on their own cache tag", async () => {
        parseBodyMock.mockResolvedValue({
            isValidSignature: true,
            body: { _type: "project" },
        });
        const POST = await importPost();

        const response = await POST(request());

        expect(response.status).toBe(200);
        expect(revalidateTagMock).toHaveBeenCalledExactlyOnceWith(
            "project",
            "max",
        );
        expect(afterMock).not.toHaveBeenCalled();
    });

    it("does not allow arbitrary document types to schedule warming", async () => {
        parseBodyMock.mockResolvedValue({
            isValidSignature: true,
            body: { _type: "other" },
        });
        const POST = await importPost();

        const response = await POST(request());

        expect(response.status).toBe(404);
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
