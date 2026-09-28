import type { APIRequestContext, TestInfo } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * The pages every build has, whatever the content. Specs generate one test
 * per page here; posts, tag pages and project pages differ between the
 * fixture build and a real-content preview, so they are read from the
 * sitemap at run time (`contentPages`).
 */
export const STATIC_PAGES = [
    "/",
    "/about",
    "/portfolio",
    "/resume",
    "/contact",
    "/blog",
    "/blog/archive",
] as const;

/**
 * Renderer fixtures reachable only in the fixture build. The project essay
 * exercises every custom rich-prose block (callout, gallery, image, code,
 * media embed) but is never listed, so the sitemap does not include it.
 */
const FIXTURE_ONLY_PAGES = ["/portfolio/portable-text-project-fixture"];

/** Unknown URLs, one per routing case: unmatched, and each dynamic segment. */
export const MISSING_PAGES = {
    unmatched: "/e2e-missing-page",
    post: "/blog/e2e-missing-post",
    tag: "/blog/tags/e2e-missing-tag",
    project: "/portfolio/e2e-missing-project",
} as const;

/** Every page the sitemap lists, as same-origin paths. */
export async function sitemapPages(
    request: APIRequestContext,
): Promise<string[]> {
    const response = await request.get("/sitemap.xml");
    expect(response.status(), "/sitemap.xml").toBe(200);
    const xml = await response.text();
    const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
        ([, loc]) => new URL(loc).pathname,
    );
    expect(paths.length, "sitemap entries").toBeGreaterThan(0);
    return paths;
}

/**
 * Posts, tag pages and project pages: the sitemap entries beyond
 * STATIC_PAGES, plus the fixture-only renderer pages on the fixture build.
 */
export async function contentPages(
    request: APIRequestContext,
    testInfo: TestInfo,
): Promise<string[]> {
    const listed = await sitemapPages(request);
    const staticPages = new Set<string>(STATIC_PAGES);
    return [
        ...listed.filter((path) => !staticPages.has(path)),
        ...(testInfo.project.name === "fixture" ? FIXTURE_ONLY_PAGES : []),
    ];
}

/** True for a post page (`/blog/<slug>`), not the archive or a tag page. */
export function isPostPage(path: string): boolean {
    return /^\/blog\/(?!tags\/|archive$)[^/]+$/.test(path);
}

/** A same-origin path for an absolute URL the site emits (og:image etc.). */
export function sitePath(url: string): string {
    const { pathname, search } = new URL(url);
    return `${pathname}${search}`;
}
