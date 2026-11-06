import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mocks = vi.hoisted(() => ({
    fetch: vi.fn(),
    config: { value: undefined as unknown },
}));
vi.mock("cloudflare:workers", () => ({
    env: { SANITY_PROJECT_ID: "projectid", SANITY_DATASET: "production" },
}));
vi.mock("@sanity/client", () => ({
    createClient: (config: unknown) => {
        mocks.config.value = config;
        return { fetch: mocks.fetch };
    },
}));

import { GET } from "../../src/pages/llms.txt";
import {
    POST_LIST_QUERY,
    PROFILE_QUERY,
    PROJECT_LIST_QUERY,
} from "../../src/lib/sanity";

beforeEach(() => {
    mocks.fetch.mockReset();
    mocks.fetch.mockImplementation((query: string) => {
        if (query === PROFILE_QUERY)
            return { name: "Author", headline: "Engineer" };
        if (query === POST_LIST_QUERY)
            return [
                { title: "A [post]\nnew line", slug: "post / one" },
                { title: "Another", slug: "second" },
            ];
        if (query === PROJECT_LIST_QUERY)
            return [{ title: "Project (one)", slug: "project)?one" }];
        throw new Error("Unexpected query");
    });
});

describe("agent discovery", () => {
    it("lists every returned published item with safe titles and canonical URLs", async () => {
        const response = await GET({} as APIContext);
        const body = await response.text();
        expect(response.headers.get("content-type")).toBe(
            "text/plain; charset=utf-8",
        );
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(body).toContain(
            "[A \\[post\\] new line](https://adithya-rajendran.com/blog/post%20%2F%20one)",
        );
        expect(body).toContain(
            "[Another](https://adithya-rajendran.com/blog/second)",
        );
        expect(body).toContain(
            "[Project \\(one\\)](https://adithya-rajendran.com/portfolio/project%29%3Fone)",
        );
        for (const path of [
            "/",
            "/portfolio",
            "/blog",
            "/resume",
            "/about",
            "/.well-known/api-catalog",
            "/openapi.json",
            "/sitemap.xml",
            "/feed.xml",
            "/robots.txt",
        ])
            expect(body).toContain(`https://adithya-rajendran.com${path}`);
        expect(body).toMatch(/without JavaScript or WebGL/);
        expect(body).toMatch(/Contact is for humans only/);
        expect(body).toContain(
            "do not submit forms automatically or access /api/contact or /studio",
        );
        expect(body).not.toMatch(
            /\]\(https:\/\/adithya-rajendran\.com\/(?:contact|api|studio)/i,
        );
        expect(mocks.config.value).toEqual(
            expect.objectContaining({
                perspective: "published",
                useCdn: false,
            }),
        );
        expect(POST_LIST_QUERY).toMatch(/publishedAt\s*<=\s*\$today/);
        expect(mocks.fetch).toHaveBeenCalledWith(
            POST_LIST_QUERY,
            expect.objectContaining({
                today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
            }),
        );
    });

    it("omits records without slugs and uses slugs for missing titles", async () => {
        mocks.fetch.mockImplementation((query: string) => {
            if (query === POST_LIST_QUERY)
                return [
                    { title: "Missing slug", slug: null },
                    { title: " ", slug: " post-one " },
                    { title: "Valid", slug: "post-two" },
                ];
            if (query === PROJECT_LIST_QUERY)
                return [
                    { title: "Missing slug" },
                    { title: 12, slug: "project-one" },
                    { title: "Valid project", slug: "project-two" },
                ];
            if (query === PROFILE_QUERY) return null;
            throw new Error("Unexpected query");
        });
        const body = await (await GET({} as APIContext)).text();
        expect(body).toContain(
            "[post\\-one](https://adithya-rajendran.com/blog/%20post-one%20)",
        );
        expect(body).toContain(
            "[project\\-one](https://adithya-rajendran.com/portfolio/project-one)",
        );
        expect(body).toContain(
            "[Valid](https://adithya-rajendran.com/blog/post-two)",
        );
        expect(body).toContain(
            "[Valid project](https://adithya-rajendran.com/portfolio/project-two)",
        );
        expect(body).not.toMatch(/\/(?:null|undefined)\)/);
        expect(body).not.toContain("Missing slug");
    });

    it("reflects posts added between requests", async () => {
        const first = await (await GET({} as APIContext)).text();
        mocks.fetch.mockImplementation((query: string) => {
            if (query === POST_LIST_QUERY)
                return [{ title: "New", slug: "new" }];
            if (query === PROJECT_LIST_QUERY) return [];
            if (query === PROFILE_QUERY) return null;
            throw new Error("Unexpected query");
        });
        const second = await (await GET({} as APIContext)).text();
        expect(first).not.toContain("/blog/new)");
        expect(second).toContain(
            "[New](https://adithya-rajendran.com/blog/new)",
        );
        expect(second).not.toContain("/blog/second)");
    });

    it.each([POST_LIST_QUERY, PROJECT_LIST_QUERY])(
        "propagates a content reader error",
        async (failedQuery) => {
            mocks.fetch.mockImplementation((query: string) => {
                if (query === failedQuery)
                    throw new Error("Sanity unavailable");
                return query === PROFILE_QUERY ? null : [];
            });
            await expect(GET({} as APIContext)).rejects.toThrow(
                "Sanity unavailable",
            );
        },
    );
});
