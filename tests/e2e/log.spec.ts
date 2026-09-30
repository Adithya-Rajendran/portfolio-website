import type { Page } from "@playwright/test";
import { logCopy } from "@/lib/copy";
import { tagLabel } from "@/lib/tags";
import { expect, test, prepareContext } from "./support/test";
import { THEMES, storeTheme } from "./support/theme";

/**
 * Writing (/blog, G8, plan §6.2 PR 9): the first entries sit in the first
 * viewport, newest first in the same order on every list, "Updated" only
 * on an entry the owner revised, no chart, a tag only once it gathers two
 * entries (on a row and as a chip, with no "#"), a year head only across
 * two years, a quiet head (one follow line, no search) and the archive
 * linked after the index, the chips count and open their pages, a tag
 * page's h1 in words, the archive searches, and the index stays within
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
        updated: string | null;
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
        const updated = item.getByText(new RegExp(`^${logCopy.updated} `));
        const tags = await item
            .getByRole("list", { name: logCopy.tagList })
            .getByRole("link")
            .allTextContents();
        out.push({
            href,
            title: (await link.textContent()) ?? "",
            filed: times[0] ?? "",
            updated: (await updated.count())
                ? ((await updated.locator("time").getAttribute("datetime")) ??
                  "")
                : null,
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

    await page.goto("/blog/archive");
    expect((await rows(page)).map((row) => row.href)).toEqual(
        index.map((row) => row.href),
    );

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

test("a tag shows only once it gathers two entries, a year only across two, and the head stays quiet", async ({
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
    // No "#" before a tag, on a row or a chip.
    await expect(main.getByText(/^#/)).toHaveCount(0);
    expect(
        await main
            .locator(".tag")
            .evaluateAll((tags) =>
                tags.map((tag) => getComputedStyle(tag, "::before").content),
            ),
    ).not.toContain('"#"');
    // A year head only where the entries span two years.
    const years = new Set(index.map((row) => row.filed.slice(0, 4)));
    await expect(main.getByRole("heading", { name: /^\d{4}$/ })).toHaveCount(
        years.size > 1 ? years.size : 0,
    );
    // The head: the follow line as text links, no search and no boxes.
    await expect(main.getByRole("searchbox")).toHaveCount(0);
    await expect(main.getByRole("link", { name: /search/i })).toHaveCount(0);
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

test("an entry shows Updated only after a revision", async ({ page }) => {
    await page.goto("/blog");
    for (const row of await rows(page)) {
        if (row.updated) expect(row.updated > row.filed, row.href).toBe(true);
    }
});

test("the revised fixture entry shows its revision date", async ({
    page,
}, testInfo) => {
    test.skip(testInfo.project.name !== "fixture", FIXTURE_ONLY);
    await page.goto("/blog");
    const updated = (await rows(page)).filter((row) => row.updated);
    expect(updated).toEqual([
        expect.objectContaining({
            href: "/blog/fixture-post-code-and-links",
            updated: "2026-07-02",
        }),
    ]);
});

test("tag chips appear once a tag gathers two entries; the archive is linked after the index", async ({
    page,
}) => {
    await page.goto("/blog");
    const index = await rows(page);
    const counts = new Map<string, number>();
    for (const row of index) {
        for (const tag of row.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    const shared = [...counts.values()].some((count) => count >= 2);
    const chips = page.getByRole("group", { name: logCopy.tags });
    await expect(chips).toHaveCount(shared ? 1 : 0);
    const archive = page
        .getByRole("main")
        .getByRole("link", { name: logCopy.archive.title, exact: true });
    await expect(archive).toHaveAttribute("href", "/blog/archive");
    // A quiet link after the last entry, not a head action.
    const last = (await entryRows(page).last().boundingBox())!;
    const link = (await archive.boundingBox())!;
    expect(link.y).toBeGreaterThanOrEqual(last.y + last.height);

    // The archive keeps its search and applies the same rule to its chips.
    await archive.click();
    await expect(page).toHaveURL(/\/blog\/archive$/);
    await expect(page.getByRole("group", { name: logCopy.tags })).toHaveCount(
        shared ? 1 : 0,
    );
});

test("tag chips show their counts and open their tag page", async ({
    page,
}, testInfo) => {
    test.skip(testInfo.project.name !== "fixture", FIXTURE_ONLY);
    await page.goto("/blog");
    const entries = (await rows(page)).length;
    const chips = page.getByRole("group", { name: logCopy.tags });
    const all = chips.getByRole("link", {
        name: new RegExp(`^${logCopy.all}`),
    });
    await expect(all).toHaveAttribute("aria-current", "page");
    await expect(all).toHaveAccessibleName(
        `${logCopy.all}, ${entries} ${entries === 1 ? "entry" : "entries"}`,
    );

    const chip = chips.getByRole("link").nth(1);
    const name = (await chip.getAttribute("href"))!.split("/").pop()!;
    // Named "notes, 2 entries", drawn "notes 2".
    const count = Number(/(\d+)\s*$/.exec(await chip.innerText())?.[1]);
    await expect(chip).toHaveAccessibleName(
        `${name}, ${count} ${count === 1 ? "entry" : "entries"}`,
    );
    // Only a tag that links has a chip.
    expect(count).toBeGreaterThanOrEqual(2);
    await chip.click();
    await expect(page).toHaveURL(new RegExp(`/blog/tags/${name}$`));
    await expect(
        page.getByRole("heading", { level: 1, name: tagLabel(name) }),
    ).toBeVisible();
    const tagged = await rows(page);
    expect(tagged).toHaveLength(count);
    for (const row of tagged) expect(row.tags, row.href).toContain(name);
    await expect(
        page
            .getByRole("group", { name: logCopy.tags })
            .getByRole("link", { name: new RegExp(`^${name},`) }),
    ).toHaveAttribute("aria-current", "page");
});

test("an unknown or malformed tag answers 404", async ({ request }) => {
    for (const path of ["/blog/tags/e2e-missing-tag", "/blog/tags/Not_A_Tag"]) {
        const response = await request.get(path);
        expect(response.status(), path).toBe(404);
    }
});

test("the archive searches titles, standfirsts and tags", async ({ page }) => {
    await page.goto("/blog/archive");
    const all = await rows(page);
    // The count speaks only while a search narrows the list.
    const status = page.getByRole("main").getByRole("status");
    await expect(status).toHaveText("");
    const search = page.getByRole("searchbox", {
        name: logCopy.archive.searchLabel,
    });

    // The last entry's first tag, or, while no tag links (each gathers
    // one entry), the first word of its title.
    const last = all[all.length - 1];
    const term = last.tags[0] ?? last.title.trim().split(/\s+/)[0];
    await search.fill(term);
    await expect(status).toContainText(` of ${all.length}`);
    // Every row shown matches, by tag or by text.
    const found = await rows(page);
    expect(found.map((row) => row.href)).toContain(last.href);
    expect(found.length).toBeGreaterThanOrEqual(
        all.filter((row) => row.tags.includes(term)).length,
    );

    await search.fill("e2e-matches-nothing");
    await expect(
        page.getByText(logCopy.archive.noMatch, { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: logCopy.archive.clear }).click();
    await expect(search).toHaveValue("");
    expect(await rows(page)).toHaveLength(all.length);
});

test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("the archive lists every entry and hides the search", async ({
        page,
    }) => {
        await page.goto("/blog");
        const entries = (await rows(page)).length;
        await page.goto("/blog/archive");
        expect(await rows(page)).toHaveLength(entries);
        await expect(page.getByRole("searchbox")).toHaveCount(0);
    });
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
