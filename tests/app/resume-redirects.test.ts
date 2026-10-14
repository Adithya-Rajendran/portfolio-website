import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { RESUME_FILENAME } from "@/lib/resume";

// vi.hoisted: the next/server mock factory runs as soon as this file's
// own `import { NextRequest }` executes — before ordinary top-level
// consts initialize.
const { calls, profileMock } = vi.hoisted(() => ({
    calls: [] as string[],
    profileMock: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof import("next/server")>();
    // connection() needs a live request scope; tests have none.
    return {
        ...actual,
        connection: async () => {
            calls.push("connection");
        },
    };
});

vi.mock("@/lib/sanity-client", () => ({
    getProfile: async () => {
        calls.push("getProfile");
        return profileMock();
    },
}));

const PDF = "https://cdn.sanity.io/files/example/production/abc123.pdf";

const routes = {
    view: () => import("@/app/(site)/resume/view/route"),
    download: () => import("@/app/(site)/resume/download/route"),
};

beforeEach(() => {
    calls.length = 0;
    profileMock.mockReset();
});

describe.each([
    ["view", PDF],
    ["download", `${PDF}?dl=${RESUME_FILENAME}`],
] as const)("GET /resume/%s", (mode, location) => {
    const request = () => new NextRequest(`https://example.com/resume/${mode}`);

    it("reads the cached profile on every request, after connection()", async () => {
        // Without connection() first, the build prerenders a handler that
        // reads only cached data, and the redirect stays the build's.
        profileMock.mockResolvedValue({ resumeUrl: PDF });
        const { GET } = await routes[mode]();

        await GET(request());
        await GET(request());

        expect(calls).toEqual([
            "connection",
            "getProfile",
            "connection",
            "getProfile",
        ]);
    });

    it("redirects to the profile's current PDF, never stored", async () => {
        profileMock.mockResolvedValue({ resumeUrl: PDF });
        const { GET } = await routes[mode]();

        const res = await GET(request());

        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toBe(location);
        expect(res.headers.get("cache-control")).toBe("private, no-store");
    });

    it("sends the reader back to /resume when there is no PDF", async () => {
        profileMock.mockResolvedValue({ resumeUrl: null });
        const { GET } = await routes[mode]();

        const res = await GET(request());

        expect(res.status).toBe(303);
        expect(res.headers.get("location")).toBe("https://example.com/resume");
        expect(res.headers.get("cache-control")).toBe("private, no-store");
    });
});
