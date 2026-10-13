import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// vi.hoisted: the next/server mock factory runs as soon as this file's
// own `import { NextRequest }` executes — before ordinary top-level
// consts initialize.
const { fetchMock, revalidateTagMock, afterMock, warmBlogCacheMock, state } =
    vi.hoisted(() => ({
        fetchMock: vi.fn(),
        revalidateTagMock: vi.fn(),
        // after() only works inside a real request scope — capture the
        // callback so tests can both assert scheduling and run the warm path.
        afterMock: vi.fn(),
        warmBlogCacheMock: vi.fn(),
        state: { sanityConfigured: true },
    }));

vi.mock("@/lib/sanity-config", () => ({
    client: { fetch: fetchMock },
    get isSanityConfigured() {
        return state.sanityConfigured;
    },
}));

vi.mock("next/cache", () => ({
    revalidateTag: revalidateTagMock,
}));

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof import("next/server")>();
    // connection() needs a live request scope; tests have none.
    return { ...actual, after: afterMock, connection: async () => {} };
});

vi.mock("@/actions/warmCache", () => ({
    warmBlogCache: warmBlogCacheMock,
}));

const SECRET = "test-cron-secret";

function requestWith(auth?: string): NextRequest {
    return new NextRequest("https://example.com/api/cron/publish-due", {
        headers: auth ? { authorization: auth } : {},
    });
}

async function importGet() {
    const mod = await import("@/app/api/cron/publish-due/route");
    return mod.GET;
}

beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    revalidateTagMock.mockReset();
    afterMock.mockReset();
    warmBlogCacheMock.mockReset();
    state.sanityConfigured = true;
    process.env.CRON_SECRET = SECRET;
    fetchMock.mockResolvedValue([]);
    warmBlogCacheMock.mockResolvedValue({
        pages: { warmed: [], failed: [] },
    });
});

afterEach(() => {
    delete process.env.CRON_SECRET;
});

describe("GET /api/cron/publish-due", () => {
    it("404s without revalidating when CRON_SECRET is unset", async () => {
        delete process.env.CRON_SECRET;
        const GET = await importGet();

        const res = await GET(requestWith(`Bearer ${SECRET}`));

        expect(res.status).toBe(404);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(revalidateTagMock).not.toHaveBeenCalled();
    });

    it("404s without revalidating when CRON_SECRET is spaces alone", async () => {
        process.env.CRON_SECRET = "   ";
        const GET = await importGet();

        for (const auth of ["Bearer    ", "Bearer", "Bearer "]) {
            const res = await GET(requestWith(auth));
            expect(res.status, JSON.stringify(auth)).toBe(404);
        }
        expect(fetchMock).not.toHaveBeenCalled();
        expect(revalidateTagMock).not.toHaveBeenCalled();
    });

    it("404s without revalidating on a wrong bearer token", async () => {
        const GET = await importGet();

        const res = await GET(requestWith("Bearer wrong-secret"));

        expect(res.status).toBe(404);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(revalidateTagMock).not.toHaveBeenCalled();
    });

    it("404s without revalidating when the header is missing", async () => {
        const GET = await importGet();

        const res = await GET(requestWith());

        expect(res.status).toBe(404);
        expect(revalidateTagMock).not.toHaveBeenCalled();
    });

    it("404s when Sanity is not configured", async () => {
        state.sanityConfigured = false;
        const GET = await importGet();

        const res = await GET(requestWith(`Bearer ${SECRET}`));

        expect(res.status).toBe(404);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(revalidateTagMock).not.toHaveBeenCalled();
    });

    it("no-ops with 200 when nothing is due today", async () => {
        const GET = await importGet();

        const res = await GET(requestWith(`Bearer ${SECRET}`));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ revalidated: false, due: 0 });
        expect(revalidateTagMock).not.toHaveBeenCalled();
        expect(afterMock).not.toHaveBeenCalled();
    });

    it("queries the posts dated in the last week, up to the current UTC date", async () => {
        // Just after midnight UTC: still the evening before in California.
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-03-01T00:05:00Z"));
        try {
            const GET = await importGet();

            await GET(requestWith(`Bearer ${SECRET}`));

            const [query, params] = fetchMock.mock.calls[0];
            expect(query).toContain("publishedAt > $since");
            expect(query).toContain("publishedAt <= $today");
            // A post dated 23 Feb to 1 Mar is due: a run missed on any of
            // those days is caught up by this one.
            expect(params).toEqual({
                since: "2026-02-22",
                today: "2026-03-01",
            });
        } finally {
            vi.useRealTimers();
        }
    });

    it("accepts only the exact bearer, compared in constant time", async () => {
        const GET = await importGet();

        for (const auth of [
            `Bearer ${SECRET}x`,
            `Bearer ${SECRET.slice(0, -1)}`,
            `bearer ${SECRET}`,
            SECRET,
        ]) {
            const res = await GET(requestWith(auth));
            expect(res.status, auth).toBe(404);
        }
        expect(fetchMock).not.toHaveBeenCalled();
        const res = await GET(requestWith(`Bearer ${SECRET}`));
        expect(res.status).toBe(200);
    });

    it("revalidates the post tag and schedules warming", async () => {
        fetchMock.mockResolvedValue(["post-a", "post-b", null]);
        const GET = await importGet();

        const res = await GET(requestWith(`Bearer ${SECRET}`));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            revalidated: true,
            due: 2,
            slugs: ["post-a", "post-b"],
            warming: "scheduled",
        });
        expect(revalidateTagMock).toHaveBeenCalledWith("post", "max");
        expect(revalidateTagMock).toHaveBeenCalledTimes(1);

        // The scheduled callback actually warms the cache.
        expect(afterMock).toHaveBeenCalledTimes(1);
        await afterMock.mock.calls[0][0]();
        expect(warmBlogCacheMock).toHaveBeenCalledTimes(1);
    });

    it("responds 500 without revalidating when the Sanity query fails", async () => {
        fetchMock.mockRejectedValue(new Error("network down"));
        const GET = await importGet();

        const res = await GET(requestWith(`Bearer ${SECRET}`));

        expect(res.status).toBe(500);
        expect(revalidateTagMock).not.toHaveBeenCalled();
        expect(afterMock).not.toHaveBeenCalled();
    });
});
