import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { siteConfig } from "@/lib/config";
import {
    warm,
    warmBlogCache,
    warmProfileCache,
    warmProjectCache,
} from "@/actions/warmCache";
import { warmPaths } from "@/lib/route-tags";
import type { PostListItem } from "@/lib/sanity-client";

const { postsMock, projectSlugsMock } = vi.hoisted(() => ({
    postsMock: vi.fn(),
    projectSlugsMock: vi.fn(),
}));

// getWarmLists reads the published lists uncached; the mocks stand in for
// the posts and project slugs it returns.
vi.mock("@/lib/sanity-client", () => ({
    getWarmLists: async () => ({
        posts: ((await postsMock()) as PostListItem[]).map(
            ({ slug, tags }) => ({ slug, tags: tags ?? [] }),
        ),
        projectSlugs: await projectSlugsMock(),
    }),
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

const url = (path: string) => `${siteConfig.url}${path}`;

beforeEach(() => {
    postsMock.mockReset();
    postsMock.mockResolvedValue([postOf()]);
    projectSlugsMock.mockReset();
    projectSlugsMock.mockResolvedValue(["homelab"]);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("warm", () => {
    it("requests exactly the routes lib/route-tags.ts lists under each tag", async () => {
        const lists = {
            post: ["vision-experiment"],
            tag: ["robotics"],
            project: ["homelab"],
        };
        for (const tag of ["post", "profile", "project"] as const) {
            fetchMock.mockClear();
            const result = await warm(tag);
            const expected = warmPaths(tag, lists).map(({ path }) => url(path));
            expect(result.pages.warmed, tag).toEqual(expected);
            expect(result.pages.failed, tag).toEqual([]);
            expect(fetchMock.mock.calls.map(([called]) => called)).toEqual(
                expected,
            );
        }
    });

    it("stays on the site, away from the Studio and the API", async () => {
        for (const tag of ["post", "profile", "project"] as const) {
            await warm(tag);
        }
        const called = fetchMock.mock.calls.map(([target]) => target as string);
        expect(
            called.every((target) => new URL(target).origin === siteConfig.url),
        ).toBe(true);
        expect(
            called.some(
                (target) =>
                    target.includes("/studio") || target.includes("/api/"),
            ),
        ).toBe(false);
    });
});

describe("warmBlogCache", () => {
    it("refreshes the entry points, the article, its topic and the pages that list posts", async () => {
        const result = await warmBlogCache();

        expect(result.pages.failed).toEqual([]);
        expect(result.pages.warmed).toEqual(
            expect.arrayContaining([
                url("/"),
                url("/blog"),
                url("/blog/archive"),
                url("/feed.xml"),
                url("/blog/vision-experiment"),
                url("/blog/tags/robotics"),
                // Pages that list posts since the redesign's route map.
                url("/about"),
                url("/portfolio"),
                url("/portfolio/homelab"),
            ]),
        );
        expect(fetchMock).toHaveBeenCalledWith(url("/"), {
            headers: { "x-cache-warm": "1" },
        });
    });

    it("refreshes listings after the final post and project are removed", async () => {
        postsMock.mockResolvedValue([]);
        projectSlugsMock.mockResolvedValue([]);

        const result = await warmBlogCache();

        expect(result.pages.failed).toEqual([]);
        expect(result.pages.warmed).toEqual(
            expect.arrayContaining([
                url("/"),
                url("/blog"),
                url("/blog/archive"),
                url("/feed.xml"),
            ]),
        );
        expect(result.pages.warmed.some((target) => target.includes("["))).toBe(
            false,
        );
    });

    it("isolates a failing homepage response and rejects unsafe document URLs", async () => {
        postsMock.mockResolvedValue([
            postOf(),
            postOf({ slug: "../../api/revalidate", tags: ["../admin"] }),
        ]);
        projectSlugsMock.mockResolvedValue(["homelab", "../studio"]);
        fetchMock.mockImplementation(async (target: string) => ({
            ok: target !== url("/"),
            status: target === url("/") ? 503 : 200,
        }));

        const result = await warmBlogCache();

        expect(result.pages.failed).toEqual([url("/")]);
        expect(result.pages.warmed).toContain(url("/blog/vision-experiment"));
        expect(
            fetchMock.mock.calls.every(([target]) => !target.includes("..")),
        ).toBe(true);
    });
});

describe("warmProfileCache", () => {
    it("refreshes identity pages, sharing images and every page that shows the profile's content", async () => {
        const result = await warmProfileCache();

        expect(result.pages.failed).toEqual([]);
        expect(result.pages.warmed).toEqual(
            expect.arrayContaining([
                url("/"),
                url("/about"),
                url("/portfolio"),
                url("/resume"),
                url("/contact"),
                url("/blog"),
                url("/blog/archive"),
                url("/feed.xml"),
                url("/opengraph-image-12o0cb"),
                url("/about/opengraph-image-1ycygp"),
                url("/contact/opengraph-image-upzrkl"),
                url("/portfolio/opengraph-image-98lokn"),
                url("/blog/opengraph-image-14vkmf"),
                url("/blog/archive/opengraph-image-dfhyke"),
                url("/resume/view"),
                url("/resume/download"),
            ]),
        );
    });

    it("warms the CV links without following them to the PDF", async () => {
        fetchMock.mockImplementation(async (target: string) =>
            [url("/resume/view"), url("/resume/download")].includes(target)
                ? { ok: false, status: 307 }
                : { ok: true, status: 200 },
        );

        const result = await warmProfileCache();

        expect(result.pages.failed).toEqual([]);
        expect(fetchMock).toHaveBeenCalledWith(url("/resume/view"), {
            headers: { "x-cache-warm": "1" },
            redirect: "manual",
        });
        expect(fetchMock).toHaveBeenCalledWith(url("/resume"), {
            headers: { "x-cache-warm": "1" },
        });
    });

    it("counts a redirect from a page, or an error from a CV link, as a failure", async () => {
        fetchMock.mockImplementation(async (target: string) => {
            if (target === url("/about")) return { ok: false, status: 308 };
            if (target === url("/resume/download")) {
                return { ok: false, status: 500 };
            }
            return { ok: true, status: 200 };
        });

        const result = await warmProfileCache();

        expect(result.pages.failed).toEqual([
            url("/about"),
            url("/resume/download"),
        ]);
    });

    it("continues refreshing the feed and sharing images after a profile page fails", async () => {
        fetchMock.mockImplementation(async (target: string) => {
            if (target === url("/about")) throw new Error("connection failed");
            return { ok: true, status: 200 };
        });

        const result = await warmProfileCache();

        expect(result.pages.failed).toEqual([url("/about")]);
        expect(result.pages.warmed).toContain(url("/feed.xml"));
        expect(result.pages.warmed).toContain(
            url("/blog/opengraph-image-14vkmf"),
        );
    });
});

describe("warmProjectCache", () => {
    it("refreshes the mission page, the pages that list missions and the posts that link to them", async () => {
        projectSlugsMock.mockResolvedValue(["homelab", "website"]);

        const result = await warmProjectCache();

        expect(result.pages.failed).toEqual([]);
        expect(result.pages.warmed).toEqual(
            expect.arrayContaining([
                url("/portfolio/homelab"),
                url("/portfolio/website"),
                url("/portfolio"),
                url("/portfolio/opengraph-image-98lokn"),
                url("/"),
                url("/about"),
                url("/resume"),
                url("/sitemap.xml"),
                url("/blog/vision-experiment"),
            ]),
        );
        // Tag pages and the feed show no project content.
        expect(result.pages.warmed).not.toContain(url("/blog/tags/robotics"));
        expect(result.pages.warmed).not.toContain(url("/feed.xml"));
    });
});
