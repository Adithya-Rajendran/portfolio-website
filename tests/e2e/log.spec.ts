import type { Page } from "@playwright/test";
import { logCopy } from "@/lib/copy";
import { expect, test, prepareContext } from "./support/test";
import { THEMES, storeTheme } from "./support/theme";

/**
 * The Flight Log (G8, plan §6.2 PR 9): the first entries sit in the first
 * viewport, LOG numbers count up from the oldest entry and hold on every
 * list, the tag chips count and open their pages, the archive searches, the
 * chart's marks lead to their entries, and the index stays within the
 * prefetch budget (plan §4.6 rule 8, §7.1).
 */

const LOG = /^LOG \d{3,}$/;

/** Each entry row on the visible page: its LOG number, link and tags. */
async function rows(page: Page) {
    const items = page
        .getByRole("main")
        .getByRole("listitem")
        .filter({ has: page.getByText(LOG) });
    const out: { log: number; href: string; filed: string; tags: string[] }[] =
        [];
    for (const item of await items.all()) {
        const log = (await item.getByText(LOG).textContent()) ?? "";
        const href =
            (await item
                .getByRole("heading")
                .getByRole("link")
                .getAttribute("href")) ?? "";
        const filed =
            (await item.locator("time").getAttribute("datetime")) ?? "";
        const tags = await item
            .getByRole("list", { name: logCopy.tagList })
            .getByRole("link")
            .allTextContents();
        out.push({ log: Number(log.slice(4)), href, filed, tags });
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
            const first = page
                .getByRole("main")
                .getByRole("listitem")
                .filter({ has: page.getByText(LOG) })
                .first();
            await expect(first.getByText(LOG)).toBeInViewport({ ratio: 1 });
            await expect(first.getByRole("heading")).toBeInViewport({
                ratio: 1,
            });
        });
    }
}

test("LOG numbers count up from the oldest entry and hold on every list", async ({
    page,
}) => {
    await page.goto("/blog");
    const index = await rows(page);
    expect(index.length).toBeGreaterThan(0);
    // Newest first: n … 1, and a higher number is never filed earlier.
    expect(index.map((row) => row.log)).toEqual(
        index.map((_, i) => index.length - i),
    );
    for (let i = 1; i < index.length; i++) {
        expect(index[i - 1].filed >= index[i].filed).toBe(true);
    }
    const numbers = new Map(index.map((row) => [row.href, row.log]));

    await page.goto("/blog/archive");
    const archive = await rows(page);
    expect(archive.map((row) => [row.href, row.log])).toEqual(
        index.map((row) => [row.href, row.log]),
    );

    const tag = index[0].tags[0];
    await page.goto(`/blog/tags/${tag}`);
    for (const row of await rows(page)) {
        expect(row.log, row.href).toBe(numbers.get(row.href));
    }
});

test("tag chips show their counts and open their tag page", async ({
    page,
}) => {
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
    const status = page.getByRole("main").getByRole("status");
    await expect(status).toHaveText(
        `${all.length} ${all.length === 1 ? "entry" : "entries"}`,
    );
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

test("each mark on the chart leads to its entry", async ({ page }) => {
    await page.goto("/blog");
    const index = await rows(page);
    const figure = page.getByRole("figure", { name: /Entries by date/ });
    // The plot is a picture of the index (aria-hidden): its marks are
    // pointer targets that link to the same entries.
    const marks = figure.locator("a");
    await expect(marks).toHaveCount(index.length);
    expect(
        (
            await marks.evaluateAll((links) =>
                links.map((link) => link.getAttribute("href")),
            )
        ).sort(),
    ).toEqual(index.map((row) => row.href).sort());
    await marks.first().click();
    await expect(page).toHaveURL(new RegExp(`${index[0].href}$`));
});

test("the index stays within the prefetch budget", async ({
    browser,
    baseURL,
}, testInfo) => {
    // Plan §4.6 rule 8 and §7.1: at most 8 page prefetches on first view.
    // The tag pages share one App Shell (`prefetch = "partial"` on their
    // route), and the chart's marks do not prefetch. Each distinct URL also
    // asks for its route tree (`/_tree`), a small static response that is
    // reported, not budgeted.
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
