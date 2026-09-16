import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { siteConfig } from "@/lib/config";
import { warmBlogCache, warmProfileCache } from "@/actions/warmCache";
import type { PostListItem } from "@/lib/sanity-client";

const { getAllPostsMock } = vi.hoisted(() => ({
    getAllPostsMock: vi.fn(),
}));

vi.mock("@/lib/sanity-client", () => ({
    getAllPosts: getAllPostsMock,
}));

const fetchMock = vi.fn();

function postOf(overrides: Partial<PostListItem> = {}): PostListItem {
    return {
        _id: "post",
        title: "Vision experiment",
        slug: "vision-experiment",
        description: "Notes from an experiment.",
        publishedAt: "2026-09-16",
        wordCount: 100,
        tags: ["robotics"],
        ...overrides,
    };
}

beforeEach(() => {
    getAllPostsMock.mockReset();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("warmBlogCache", () => {
    it("refreshes the home entry point alongside the published article and its topic", async () => {
        getAllPostsMock.mockResolvedValue([postOf()]);

        const result = await warmBlogCache();

        expect(result.pages.failed).toEqual([]);
        expect(result.pages.warmed).toEqual(
            expect.arrayContaining([
                `${siteConfig.url}/`,
                `${siteConfig.url}/feed.xml`,
                `${siteConfig.url}/blog/vision-experiment`,
                `${siteConfig.url}/blog/tags/robotics`,
            ]),
        );
        expect(fetchMock).toHaveBeenCalledWith(`${siteConfig.url}/`, {
            headers: { "x-cache-warm": "1" },
        });
    });

    it("refreshes empty listings after the final post is unpublished", async () => {
        getAllPostsMock.mockResolvedValue([]);

        const result = await warmBlogCache();

        expect(result.pages.warmed).toEqual([
            `${siteConfig.url}/`,
            `${siteConfig.url}/blog`,
            `${siteConfig.url}/blog/archive`,
            `${siteConfig.url}/feed.xml`,
        ]);
        expect(result.pages.failed).toEqual([]);
    });

    it("isolates a failing homepage response and rejects unsafe document URLs", async () => {
        getAllPostsMock.mockResolvedValue([
            postOf(),
            postOf({ slug: "../../api/revalidate", tags: ["../admin"] }),
        ]);
        fetchMock.mockImplementation(async (url: string) => ({
            ok: url !== `${siteConfig.url}/`,
            status: url === `${siteConfig.url}/` ? 503 : 200,
        }));

        const result = await warmBlogCache();

        expect(result.pages.failed).toEqual([`${siteConfig.url}/`]);
        expect(result.pages.warmed).toContain(
            `${siteConfig.url}/blog/vision-experiment`,
        );
        expect(fetchMock.mock.calls.every(([url]) => !url.includes(".."))).toBe(
            true,
        );
    });
});

describe("warmProfileCache", () => {
    it("refreshes public identity, writing, feed, and sharing images without reading the entire post collection", async () => {
        const result = await warmProfileCache();

        expect(getAllPostsMock).not.toHaveBeenCalled();
        expect(result.pages.failed).toEqual([]);
        expect(result.pages.warmed).toEqual(
            expect.arrayContaining([
                `${siteConfig.url}/`,
                `${siteConfig.url}/about`,
                `${siteConfig.url}/portfolio`,
                `${siteConfig.url}/resume`,
                `${siteConfig.url}/blog`,
                `${siteConfig.url}/blog/archive`,
                `${siteConfig.url}/feed.xml`,
                `${siteConfig.url}/opengraph-image`,
                `${siteConfig.url}/about/opengraph-image`,
                `${siteConfig.url}/portfolio/opengraph-image`,
                `${siteConfig.url}/blog/opengraph-image`,
            ]),
        );
        expect(
            fetchMock.mock.calls.every(
                ([url]) => new URL(url).origin === siteConfig.url,
            ),
        ).toBe(true);
        expect(
            fetchMock.mock.calls.some(
                ([url]) => url.includes("/studio") || url.includes("/api/"),
            ),
        ).toBe(false);
    });

    it("continues refreshing the feed and sharing images after a profile page fails", async () => {
        fetchMock.mockImplementation(async (url: string) => {
            if (url === `${siteConfig.url}/about`)
                throw new Error("connection failed");
            return { ok: true };
        });

        const result = await warmProfileCache();

        expect(result.pages.failed).toEqual([`${siteConfig.url}/about`]);
        expect(result.pages.warmed).toContain(`${siteConfig.url}/feed.xml`);
        expect(result.pages.warmed).toContain(
            `${siteConfig.url}/blog/opengraph-image`,
        );
    });
});
