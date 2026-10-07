import type { Page } from "@playwright/test";
import { logCopy } from "@/lib/copy";
import { tagLabel } from "@/lib/tags";
import { expect, test, prepareContext } from "./support/test";
import { THEMES, storeTheme } from "./support/theme";

/**
 * Writing (/blog, G8, plan §6.2 PR 9): the first entries sit in the first
 * viewport, newest first in the same order on every list, one date on a
 * row (a revision is the post head's), no chart, a tag only once it
 * gathers two entries (on a row, with no "#"), one list with no year
 * heads, a quiet head (one follow line, no search, no chips) running
 * straight into the list, which ends on its rule (no archive: its address
 * answers 308 to /blog), a row's tag opening its page, whose h1 names the
 * tag in words and whose rows leave it out, and the index stays within
 * the prefetch budget (plan §4.6 rule 8, §7.1; premium WS3).
 */

const FIXTURE_ONLY = "Reads the fixture posts (lib/fixtures.ts).";

/** The visible page's entry rows: the list items with a heading. */
function entryRows(page: Page) {
    return page
        .getByRole("main")
        .getByRole("listitem")
        .filter({ has: page.getByRole("heading") });
}

/** Each entry row on the visible page: its link, dates and tags. */
async function rows(page: Page) {
    const out: {
        href: string;
        title: string;
        filed: string;
        dates: number;
        tags: string[];
    }[] = [];
    for (const item of await entryRows(page).all()) {
        const link = item.getByRole("heading").getByRole("link");
        const href = (await link.getAttribute("href")) ?? "";
        const times = await item
            .locator("time")
            .evaluateAll((nodes) =>
                nodes.map((node) => node.getAttribute("datetime") ?? ""),
            );
        const tags = await item
            .getByRole("list", { name: logCopy.tagList })
            .getByRole("link")
            .allTextContents();
        out.push({
            href,
            title: (await link.textContent()) ?? "",
            filed: times[0] ?? "",
            dates: times.length,
            tags,
        });
    }
    return out;
}

for (const [width, height] of [
    [1280, 800],
    [390, 844],
]) {
    for (const theme of THEMES) {
        test(`the first entry is in the first viewport at ${width}×${height} in ${theme}`, async ({
            page,
        }) => {
            await page.setViewportSize({ width, height });
            await storeTheme(page, theme);
            await page.goto("/blog");
            await expect(page.locator("html")).toHaveAttribute(
                "data-theme",
                theme,
            );
            const first = entryRows(page).first();
            await expect(first.locator("time").first()).toBeInViewport({
                ratio: 1,
            });
            await expect(first.getByRole("heading")).toBeInViewport({
                ratio: 1,
            });
        });
    }
}

test("a row's title balances its lines on a phone, so no word stands alone", async ({
    page,
}) => {
    const wrap = () =>
        entryRows(page)
            .first()
            .getByRole("heading")
            .evaluate((title) => getComputedStyle(title).textWrapStyle);
    await page.goto("/blog");
    expect(await wrap()).toBe("pretty");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await wrap()).toBe("balance");
});

test("entries are newest first, in the same order on every list", async ({
    page,
}) => {
    await page.goto("/blog");
    const index = await rows(page);
    expect(index.length).toBeGreaterThan(0);
    for (let i = 1; i < index.length; i++) {
        expect(index[i - 1].filed >= index[i].filed).toBe(true);
    }
    // No LOG numbers and no chart: the list is the index.
    await expect(page.getByRole("main").getByText(/^LOG \d{3,}$/)).toHaveCount(
        0,
    );
    await expect(page.getByRole("figure")).toHaveCount(0);

    // A tag shows only once it gathers two entries: none may yet.
    const tag = index.find((row) => row.tags.length)?.tags[0];
    if (tag) {
        await page.goto(`/blog/tags/${tag}`);
        const tagged = (await rows(page)).map((row) => row.href);
        expect(tagged).toEqual(
            index
                .filter((row) => row.tags.includes(tag))
                .map((row) => row.href),
        );
    }
});

test("a tag shows only once it gathers two entries, the list has no year heads, and the head stays quiet", async ({
    page,
}) => {
    await page.goto("/blog");
    const main = page.getByRole("main");
    const index = await rows(page);
    const counts = new Map<string, number>();
    for (const row of index) {
        for (const tag of row.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    for (const [tag, count] of counts) {
        expect(count, `#${tag} on the rows`).toBeGreaterThanOrEqual(2);
    }
    // No "#" before a tag.
    await expect(main.getByText(/^#/)).toHaveCount(0);
    expect(
        await main
            .locator(".tag")
            .evaluateAll((tags) =>
                tags.map((tag) => getComputedStyle(tag, "::before").content),
            ),
    ).not.toContain('"#"');
    // One list: each row's date carries its year, so no year heads.
    await expect(main.getByRole("heading", { name: /^\d{4}$/ })).toHaveCount(0);
    await expect(
        main.getByRole("list").filter({ has: page.getByRole("heading") }),
    ).toHaveCount(1);
    // The head: the follow line as text links, no search, no boxes and no
    // tag chips; the list ends on its rule, with no archive after it.
    await expect(main.getByRole("searchbox")).toHaveCount(0);
    await expect(main.getByRole("link", { name: /search/i })).toHaveCount(0);
    await expect(main.getByRole("group")).toHaveCount(0);
    await expect(main.locator(".chip")).toHaveCount(0);
    await expect(main.getByRole("link", { name: "Archive" })).toHaveCount(0);
    const follow = main.getByText(new RegExp(`^${logCopy.follow}`));
    await expect(follow).toBeVisible();
    await expect(
        follow.getByRole("link", { name: logCopy.rss, exact: true }),
    ).toHaveAttribute("href", "/feed.xml");
    await expect(main.locator(".page-head .btn")).toHaveCount(0);

    // A tag page names its tag in words, with no dek restating it.
    const tag = [...counts.keys()][0];
    if (tag) {
        await page.goto(`/blog/tags/${tag}`);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            tagLabel(tag),
        );
        await expect(page.locator(".page-head__intro:visible")).toHaveCount(0);
    }
});

test("a row carries one date: a revision is the post head's", async ({
    page,
}) => {
    await page.goto("/blog");
    for (const row of await rows(page)) {
        expect(row.dates, row.href).toBe(1);
    }
    await expect(page.getByRole("main").getByText(/^Updated\b/)).toHaveCount(0);
});

test("/blog/archive answers 308 to /blog, and no list links it", async ({
    page,
    request,
}) => {
    const response = await request.get("/blog/archive", { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toMatch(/\/blog$/);
    await page.goto("/blog");
    await expect(
        page.getByRole("main").locator('a[href^="/blog/archive"]'),
    ).toHaveCount(0);
});

test("a row's tag opens its page, whose rows leave that tag out", async ({
    page,
}, testInfo) => {
    test.skip(testInfo.project.name !== "fixture", FIXTURE_ONLY);
    await page.goto("/blog");
    const index = await rows(page);
    const name = index.find((row) => row.tags.length)!.tags[0];
    const count = index.filter((row) => row.tags.includes(name)).length;
    // Only a tag that links is shown.
    expect(count).toBeGreaterThanOrEqual(2);
    await entryRows(page)
        .getByRole("list", { name: logCopy.tagList })
        .getByRole("link", { name, exact: true })
        .first()
        .click();
    await expect(page).toHaveURL(new RegExp(`/blog/tags/${name}$`));
    await expect(
        page.getByRole("heading", { level: 1, name: tagLabel(name) }),
    ).toBeVisible();
    // Its description says the section's word, Writing.
    const html = await (await page.request.get(`/blog/tags/${name}`)).text();
    expect(html).toContain(
        `<meta name="description" content="Writing tagged ${tagLabel(name)}."/>`,
    );
    const tagged = await rows(page);
    expect(tagged).toHaveLength(count);
    // The h1 names the tag: no row repeats it.
    for (const row of tagged) expect(row.tags, row.href).not.toContain(name);
});

test("an unknown or malformed tag answers 404", async ({ request }) => {
    for (const path of ["/blog/tags/e2e-missing-tag", "/blog/tags/Not_A_Tag"]) {
        const response = await request.get(path);
        expect(response.status(), path).toBe(404);
    }
});

test("the index stays within the prefetch budget", async ({
    browser,
    baseURL,
}, testInfo) => {
    // Plan §4.6 rule 8 and §7.1: at most 8 page prefetches on first view.
    // The tag pages share one App Shell (`prefetch = "partial"` on their
    // route). Each distinct URL also asks for its route tree (`/_tree`), a
    // small static response that is reported, not budgeted.
    for (const viewport of [
        { width: 412, height: 915 },
        { width: 1440, height: 900 },
    ]) {
        const context = await browser.newContext({ baseURL, viewport });
        await prepareContext(context, testInfo.project.name, baseURL);
        const page = await context.newPage();
        const pages: string[] = [];
        let trees = 0;
        page.on("request", (request) => {
            const headers = request.headers();
            if (headers["next-router-prefetch"] !== "1") return;
            const segment = headers["next-router-segment-prefetch"] ?? "";
            if (segment === "/_tree") trees++;
            else pages.push(segment || new URL(request.url()).pathname);
        });
        await page.goto("/blog");
        await page.waitForLoadState("networkidle");
        testInfo.annotations.push({
            type: "prefetch",
            description: `/blog at ${viewport.width}px: ${pages.length} page prefetches, ${trees} route trees`,
        });
        const at = `at ${viewport.width}px`;
        expect(pages.length, `page prefetches ${at}`).toBeGreaterThan(0);
        expect(pages.length, `page prefetches ${at}`).toBeLessThanOrEqual(8);
        // One shared App Shell for every tag page (none while no tag
        // links: a tag shows once it gathers two entries).
        const tagLinks = await page
            .getByRole("main")
            .locator('a[href^="/blog/tags/"]')
            .count();
        expect(
            pages.filter((segment) => segment.includes("/blog/tags/")),
            `tag page prefetches ${at}`,
        ).toHaveLength(tagLinks ? 1 : 0);
        await context.close();
    }
});
