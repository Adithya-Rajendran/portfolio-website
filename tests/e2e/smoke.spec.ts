import type { APIRequestContext, Page } from "@playwright/test";
import {
    expandRoute,
    ROUTE_TAGS,
    warmPaths,
    type WarmLists,
} from "@/lib/route-tags";
import { expect, test, type PageErrors } from "./support/test";
import {
    MISSING_PAGES,
    STATIC_PAGES,
    contentPages,
    sitemapPages,
    sitePath,
} from "./support/routes";

/**
 * Every page loads with its status, one `h1`, one `main`, no console
 * errors, no uncaught exceptions and no CSP violations. Returns the
 * same-origin share-image URLs the page declares.
 */
async function expectHealthyPage(
    page: Page,
    pageErrors: PageErrors,
    path: string,
    status = 200,
): Promise<string[]> {
    const response = await page.goto(path);
    expect(response?.status(), `${path} status`).toBe(status);
    // Hydration and route prefetches finish before errors are read.
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page).toHaveTitle(/\S/);
    expect(await pageErrors.drain(page), `${path} errors`).toEqual([]);
    const images = await page
        .locator('meta[property="og:image"], meta[name="twitter:image"]')
        .evaluateAll((metas) =>
            metas.map((meta) => meta.getAttribute("content") ?? ""),
        );
    return images.map(sitePath);
}

/** Each share image a page declares is served as an image. */
async function expectImages(request: APIRequestContext, paths: Set<string>) {
    for (const path of paths) {
        const response = await request.get(path);
        expect(response.status(), path).toBe(200);
        expect(response.headers()["content-type"], path).toMatch(/^image\//);
    }
}

test.describe("pages", () => {
    for (const path of STATIC_PAGES) {
        test(`${path} loads cleanly`, async ({ page, pageErrors, request }) => {
            const images = await expectHealthyPage(page, pageErrors, path);
            expect(images.length, "share images").toBeGreaterThan(0);
            await expectImages(request, new Set(images));
        });
    }

    test("every post, tag and project page loads cleanly", async ({
        page,
        pageErrors,
        request,
    }, testInfo) => {
        const paths = await contentPages(request, testInfo);
        test.setTimeout(30_000 + paths.length * 10_000);
        const images = new Set<string>();
        for (const path of paths) {
            await test.step(path, async () => {
                for (const image of await expectHealthyPage(
                    page,
                    pageErrors,
                    path,
                )) {
                    images.add(image);
                }
            });
        }
        await expectImages(request, images);
    });

    for (const [kind, path] of Object.entries(MISSING_PAGES)) {
        test(`an unknown ${kind} URL returns 404 inside the chrome`, async ({
            page,
            pageErrors,
        }) => {
            await expectHealthyPage(page, pageErrors, path, 404);
            await expect(page.getByRole("banner")).toBeVisible();
            await expect(page.getByRole("contentinfo")).toBeVisible();
        });
    }
});

test.describe("routes and headers", () => {
    test("the feed, sitemap, robots and icons respond", async ({ request }) => {
        const expectations: [path: string, type: RegExp, body?: RegExp][] = [
            ["/feed.xml", /xml/, /<rss[\s>]/],
            ["/sitemap.xml", /xml/, /<urlset[\s>]/],
            ["/robots.txt", /text\/plain/, /^Sitemap: /m],
            ["/icon.svg", /image\/svg\+xml/],
            ["/apple-icon.png", /image\/png/],
            ["/favicon.ico", /image\//],
        ];
        for (const [path, type, body] of expectations) {
            const response = await request.get(path);
            expect(response.status(), path).toBe(200);
            expect(response.headers()["content-type"], path).toMatch(type);
            if (body) expect(await response.text(), path).toMatch(body);
        }
    });

    test("every URL the route table lists answers", async ({ request }) => {
        // actions/warmCache.ts requests these paths (lib/route-tags.ts)
        // after a change; a 404 here means the table has drifted from the
        // build. The dynamic routes expand from this build's sitemap.
        const listed = await sitemapPages(request);
        const values = (pattern: RegExp) =>
            listed.flatMap((path) => pattern.exec(path)?.slice(1) ?? []);
        const lists: WarmLists = {
            post: values(/^\/blog\/(?!tags\/|archive$)([^/]+)$/),
            tag: values(/^\/blog\/tags\/([^/]+)$/),
            project: values(/^\/portfolio\/([^/]+)$/),
        };
        expect(lists.post.length, "posts in the sitemap").toBeGreaterThan(0);
        const targets = new Map(
            (["profile", "post", "project"] as const)
                .flatMap((tag) => warmPaths(tag, lists))
                .map((target) => [target.path, target]),
        );
        // Routes rendered per request are not warmed, but the table still
        // names their built URL, so they are checked here too.
        for (const route of ROUTE_TAGS.filter((item) => item.perRequest)) {
            for (const path of expandRoute(route, lists)) {
                targets.set(path, { path, redirects: false });
            }
        }
        for (const { path, redirects } of targets.values()) {
            const response = await request.get(path, {
                maxRedirects: redirects ? 0 : undefined,
            });
            if (redirects) {
                expect(response.status(), path).toBeGreaterThanOrEqual(300);
                expect(response.status(), path).toBeLessThan(400);
            } else {
                expect(response.status(), path).toBe(200);
            }
            if (path.includes("/opengraph-image-")) {
                expect(response.headers()["content-type"], path).toBe(
                    "image/png",
                );
            }
        }
    });

    test("pages send the security headers", async ({ request }) => {
        const response = await request.get("/");
        const headers = response.headers();
        expect(headers["x-powered-by"]).toBeUndefined();
        expect(headers["x-content-type-options"]).toBe("nosniff");
        expect(headers["x-frame-options"]).toBe("DENY");
        const csp = headers["content-security-policy"] ?? "";
        expect(csp).toContain("script-src-attr 'none'");
        expect(csp).toContain("frame-ancestors 'none'");
        expect(csp).toContain("object-src 'none'");

        const favicon = await request.get("/favicon.ico");
        expect(favicon.headers()["cache-control"]).toContain("max-age=86400");
    });

    test("legacy URLs redirect permanently", async ({ request, baseURL }) => {
        const redirects: [from: string, to: string][] = [
            ["/blogs/e2e-legacy-post", "/blog/e2e-legacy-post"],
            ["/resume.pdf", "/resume/view"],
            // Share images from before the (site) route group.
            ["/about/opengraph-image", "/about/opengraph-image-1ycygp"],
            [
                "/blog/archive/opengraph-image",
                "/blog/archive/opengraph-image-dfhyke",
            ],
            [
                "/blog/e2e-legacy-post/opengraph-image",
                "/blog/e2e-legacy-post/opengraph-image-fx5gi7",
            ],
        ];
        for (const [from, to] of redirects) {
            const response = await request.get(from, { maxRedirects: 0 });
            expect(response.status(), from).toBe(308);
            const location = response.headers().location ?? "";
            expect(new URL(location, baseURL).pathname, from).toBe(to);
        }
    });

    test("the Studio renders none of the site chrome", async ({ request }) => {
        const response = await request.get("/studio");
        expect(response.status()).toBe(200);
        const html = await response.text();
        expect(html).not.toContain('href="#main-content"');
        expect(html).not.toContain("application/ld+json");
        expect(html).not.toMatch(/<header[\s>]/);
        expect(html).not.toMatch(/<footer[\s>]/);
        // Nor its stylesheet: no root not-found boundary attaches it
        // (app/global-not-found.tsx).
        const sheets = [...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map(
            ([, href]) => href,
        );
        for (const href of sheets) {
            const css = await (await request.get(href)).text();
            expect(css, href).not.toContain(".site-header");
        }
    });
});
