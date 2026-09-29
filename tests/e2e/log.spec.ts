import type { Page } from "@playwright/test";
import { logCopy } from "@/lib/copy";
import { expect, test, prepareContext } from "./support/test";
import { THEMES, storeTheme } from "./support/theme";

/**
 * Writing (/blog, G8, plan §6.2 PR 9): the first entries sit in the first
 * viewport, newest first in the same order on every list, "Updated" only
 * on an entry the owner revised, no chart, the tag chips (once a tag
 * gathers two entries) count and open their pages, the archive searches,
 * and the index stays within the prefetch budget (plan §4.6 rule 8,
 * §7.1).
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
        filed: string;
        updated: string | null;
        tags: string[];
    }[] = [];
    for (const item of await entryRows(page).all()) {
        const href =
            (await item
                .getByRole("heading")
                .getByRole("link")
                .getAttribute("href")) ?? "";
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

    const tag = index[0].tags[0];
    await page.goto(`/blog/tags/${tag}`);
    const tagged = (await rows(page)).map((row) => row.href);
    expect(tagged).toEqual(
        index.filter((row) => row.tags.includes(tag)).map((row) => row.href),
    );
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

test("tag chips appear once a tag gathers two entries; the archive is always one click away", async ({
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
    const search = page
        .getByRole("main")
        .getByRole("link", { name: logCopy.search });
    await expect(search).toHaveAttribute("href", "/blog/archive");

    // The archive keeps its search and applies the same rule to its chips.
    await search.click();
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
    // Named "notes, 2 entries", drawn "#notes 2".
    const count = Number(/(\d+)\s*$/.exec(await chip.innerText())?.[1]);
    await expect(chip).toHaveAccessibleName(
        `${name}, ${count} ${count === 1 ? "entry" : "entries"}`,
    );
    expect(count).toBeGreaterThan(0);
    await chip.click();
    await expect(page).toHaveURL(new RegExp(`/blog/tags/${name}$`));
    await expect(
        page.getByRole("heading", { level: 1, name: new RegExp(`^${name}`) }),
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

    const tag = all[all.length - 1].tags[0];
    const expected = all.filter((row) => row.tags.includes(tag)).length;
    await search.fill(tag);
    await expect(status).toContainText(`${expected} of ${all.length}`);
    // Every row shown matches, by tag or by text.
    expect((await rows(page)).length).toBeGreaterThanOrEqual(expected);

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
        expect(
            pages.filter((segment) => segment.includes("/blog/tags/")),
            `tag page prefetches ${at}`,
        ).toHaveLength(1);
        await context.close();
    }
});
