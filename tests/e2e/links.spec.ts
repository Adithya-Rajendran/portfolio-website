import { expect, test } from "./support/test";
import { STATIC_PAGES, contentPages } from "./support/routes";

/** Redirect hops followed on the site before a link counts as broken. */
const MAX_HOPS = 5;

/**
 * The owner's real posts, which his seeded missions' essays link to: the
 * fixture build carries the missions but not the posts (`fixtureFromSeed`
 * in lib/fixtures.ts), so there they are not requested. A deployment has
 * them and checks them.
 */
const REAL_POSTS_ONLY = new Set([
    "/blog/my-homelab",
    "/blog/kubernetes-on-the-nvidia-dgx-spark",
]);

/**
 * The link check (the design checklist's P11): on every page the sitemap
 * lists (and the fixture-only renderer page), each same-origin link
 * answers, and each link to a fragment of the page itself names an
 * element there (`#main-content`, the contents, `#fn-1`). Links to other
 * hosts are never requested, so a third party's outage cannot fail a run;
 * a redirect is followed on the site only, and one that leaves it counts as
 * an answer. Each address is requested once, however many pages link it.
 */
test("every same-origin link answers and every fragment lands", async ({
    page,
    request,
    baseURL,
}, testInfo) => {
    const paths = [...STATIC_PAGES, ...(await contentPages(request, testInfo))];
    test.setTimeout(60_000 + paths.length * 5_000);
    // The list rather than the flight on /resume: the same links, without
    // drawing WebGL on the CPU.
    await page.emulateMedia({ reducedMotion: "reduce" });
    const origin = new URL(baseURL!).origin;
    const fixture = testInfo.project.name === "fixture";
    /** Each address's answer: "ok", or what is wrong with it. */
    const answers = new Map<string, string>();
    const broken: string[] = [];

    /** Follows redirects while they stay on the site. */
    async function answer(target: string): Promise<string> {
        let url = new URL(target, origin);
        for (let hop = 0; hop <= MAX_HOPS; hop++) {
            const key = `${url.pathname}${url.search}`;
            const known = answers.get(key);
            if (known !== undefined) return known;
            const response = await request.get(key, { maxRedirects: 0 });
            const code = response.status();
            const location = response.headers().location;
            if (code < 300 || code >= 400 || !location) {
                const result = code === 200 ? "ok" : `answers ${code}`;
                answers.set(key, result);
                return result;
            }
            url = new URL(location, url);
            if (url.origin !== origin) {
                answers.set(key, "ok");
                return "ok";
            }
        }
        return `takes more than ${MAX_HOPS} redirects`;
    }

    for (const path of paths) {
        await test.step(path, async () => {
            await page.goto(path);
            const { links, ids } = await page.evaluate(() => ({
                links: [
                    ...document.querySelectorAll<HTMLAnchorElement>("a[href]"),
                ].map((a) => {
                    const url = new URL(a.href);
                    return {
                        href: a.getAttribute("href") ?? "",
                        url: url.href,
                        here:
                            url.origin === location.origin &&
                            url.pathname === location.pathname &&
                            url.search === location.search,
                    };
                }),
                ids: [...document.querySelectorAll("[id]")].map((el) => el.id),
            }));
            const onPage = new Set(ids);
            for (const link of links) {
                const url = new URL(link.url);
                if (url.origin !== origin) continue;
                if (fixture && REAL_POSTS_ONLY.has(url.pathname)) continue;
                if (link.here && url.hash) {
                    const id = decodeURIComponent(url.hash.slice(1));
                    if (!onPage.has(id))
                        broken.push(`${path}: ${link.href} names no element`);
                    continue;
                }
                const result = await answer(link.url);
                if (result !== "ok")
                    broken.push(`${path}: ${link.href} ${result}`);
            }
        });
    }
    expect(broken).toEqual([]);
    // At least the sections the header links on every page.
    expect(answers.size, "addresses checked").toBeGreaterThanOrEqual(
        STATIC_PAGES.length,
    );
});
