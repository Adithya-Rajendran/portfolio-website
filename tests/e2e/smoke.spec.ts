import type { APIRequestContext, Page } from "@playwright/test";
import { siteConfig } from "@/lib/config";
import { lossOfSignalCopy } from "@/lib/copy";
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
    isPostPage,
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

    test("a post's and a project's share image say what they show", async ({
        page,
        request,
    }, testInfo) => {
        const content = await contentPages(request, testInfo);
        const items = [
            content.find(isPostPage),
            content.find((path) => /^\/portfolio\/[^/]+$/.test(path)),
        ];
        for (const path of items) {
            expect(path, "a post and a project").toBeTruthy();
            await page.goto(path!);
            const title = await page
                .locator('meta[property="og:title"]')
                .getAttribute("content");
            for (const alt of [
                'meta[property="og:image:alt"]',
                'meta[name="twitter:image:alt"]',
            ]) {
                await expect(
                    page.locator(alt),
                    `${path} ${alt}`,
                ).toHaveAttribute(
                    "content",
                    `${title} by ${siteConfig.author}`,
                );
            }
        }
        // Home's alt is the card's own words: the name and the headline.
        await page.goto("/");
        const home = await page
            .locator('meta[property="og:image:alt"]')
            .getAttribute("content");
        expect(home).toMatch(new RegExp(`^${siteConfig.author} — \\S`));
    });

    for (const [kind, path] of Object.entries(MISSING_PAGES)) {
        test(`an unknown ${kind} URL returns 404 inside the chrome`, async ({
            page,
            pageErrors,
        }) => {
            await expectHealthyPage(page, pageErrors, path, 404);
            await expect(page.getByRole("banner")).toBeVisible();
            await expect(page.getByRole("contentinfo")).toBeVisible();
            // The 404's own head: never home's canonical, never indexable.
            await expect(page).toHaveTitle(/^Page not found\b/);
            await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
            const robots = await page
                .locator('meta[name="robots"]')
                .evaluateAll((tags) =>
                    tags.map((tag) => tag.getAttribute("content")),
                );
            expect(robots.length, path).toBeGreaterThan(0);
            for (const content of robots) expect(content).toMatch(/noindex/);

            // The one action follows the missed address; then the trace and
            // the report, and nothing else to choose from (the nav is the
            // way to the sections).
            const [primary, href] = {
                unmatched: ["Home", "/"],
                post: ["All writing", "/blog"],
                tag: ["All writing", "/blog"],
                project: ["All projects", "/portfolio"],
            }[kind as keyof typeof MISSING_PAGES];
            const main = page.getByRole("main");
            await expect(
                main.getByRole("link", { name: primary, exact: true }),
            ).toHaveAttribute("href", href);
            await expect(main.getByRole("link")).toHaveText([
                primary,
                lossOfSignalCopy.reportLink,
            ]);
            await expect(main.getByRole("navigation")).toHaveCount(0);
            await expect(main.locator("code")).toHaveCount(0);
            // The trace is drawn already: nothing on the page moves.
            expect(
                await page.evaluate(() => document.getAnimations().length),
            ).toBe(0);
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

    test("security.txt points to the contact form, before it expires", async ({
        request,
    }) => {
        const response = await request.get("/.well-known/security.txt");
        expect(response.status()).toBe(200);
        expect(response.headers()["content-type"]).toMatch(/text\/plain/);
        const text = await response.text();
        expect(text).toMatch(
            new RegExp(`^Contact: ${siteConfig.url}/contact$`, "m"),
        );
        expect(text).toMatch(/^Preferred-Languages: en$/m);
        // No address or number: the form is the only channel.
        expect(text).not.toMatch(/mailto:|tel:|@/);
        // RFC 9116: Expires is required, within a year. Renew it yearly.
        const expires = Date.parse(/^Expires: (\S+)$/m.exec(text)?.[1] ?? "");
        expect(expires - Date.now()).toBeGreaterThan(0);
        expect(expires - Date.now()).toBeLessThan(366 * 24 * 3600 * 1000);
    });

    test("the feed's usual addresses answer 301 to /feed.xml", async ({
        request,
        baseURL,
    }) => {
        // 301, not 308: feed readers move a subscription on a 301.
        for (const from of ["/rss.xml", "/rss", "/feed", "/atom.xml"]) {
            const response = await request.get(from, { maxRedirects: 0 });
            expect(response.status(), from).toBe(301);
            const location = response.headers().location ?? "";
            expect(new URL(location, baseURL).pathname, from).toBe("/feed.xml");
        }
    });

    test("every writing page names the feed", async ({ request }, testInfo) => {
        // A page's alternates replace the layout's whole, so each route
        // names the feed itself (feedAlternates in lib/feed.ts): the
        // index, and every post and tag page listed.
        const listed = (await contentPages(request, testInfo)).filter((path) =>
            path.startsWith("/blog/"),
        );
        expect(listed.some(isPostPage), "posts in the sitemap").toBe(true);
        for (const path of ["/", "/blog", ...listed]) {
            const html = await (await request.get(path)).text();
            const links = html.match(/<link [^>]*rel="alternate"[^>]*>/g) ?? [];
            expect(
                links.filter(
                    (link) =>
                        link.includes('type="application/rss+xml"') &&
                        /href="[^"]*\/feed\.xml"/.test(link),
                ),
                path,
            ).toHaveLength(1);
        }
    });

    test("in a browser, the feed is a plain page listing the entries", async ({
        page,
        request,
    }) => {
        const xml = await (await request.get("/feed.xml")).text();
        const items = (xml.match(/<item>/g) ?? []).length;
        expect(items).toBeGreaterThan(0);
        await page.goto("/feed.xml");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            `${siteConfig.author} — Writing`,
        );
        await expect(
            page.getByText("Copy this page’s address into a feed reader."),
        ).toBeVisible();
        await expect(page.getByRole("heading", { level: 2 })).toHaveCount(
            items,
        );
        const first = page.getByRole("heading", { level: 2 }).getByRole("link");
        await expect(first.first()).toHaveAttribute(
            "href",
            new RegExp(`^${siteConfig.url}/blog/[a-z0-9-]+$`),
        );
    });

    test("every URL the route table lists answers", async ({ request }) => {
        // actions/warmCache.ts requests these paths (lib/route-tags.ts)
        // after a change; a 404 here means the table has drifted from the
        // build. The dynamic routes expand from this build's sitemap.
        const listed = await sitemapPages(request);
        const values = (pattern: RegExp) =>
            listed.flatMap((path) => pattern.exec(path)?.slice(1) ?? []);
        const lists: WarmLists = {
            post: values(/^\/blog\/(?!tags\/)([^/]+)$/),
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

        // The icons' URLs are fixed: a day, never a year.
        for (const icon of ["/favicon.ico", "/icon.svg", "/apple-icon.png"]) {
            const response = await request.get(icon);
            expect(response.headers()["cache-control"], icon).toContain(
                "max-age=86400",
            );
        }
        // A missing image is never cached for a year.
        const missing = await request.get("/no-such-image-e2e.jpg");
        expect(missing.status()).toBe(404);
        expect(missing.headers()["cache-control"] ?? "").not.toContain(
            "immutable",
        );
    });

    test("legacy URLs redirect permanently", async ({ request, baseURL }) => {
        const redirects: [from: string, to: string][] = [
            ["/blogs/e2e-legacy-post", "/blog/e2e-legacy-post"],
            // In one hop, not by way of /blog/.
            ["/blogs", "/blog"],
            ["/apple-touch-icon.png", "/apple-icon.png"],
            ["/resume.pdf", "/resume/view"],
            ["/comms", "/contact"],
            // The flight is /resume's Timeline view.
            ["/resume/trajectory", "/resume"],
            // The archive repeated /blog's list.
            ["/blog/archive", "/blog"],
            // Share images from before the (site) route group.
            ["/about/opengraph-image", "/about/opengraph-image-1ycygp"],
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
