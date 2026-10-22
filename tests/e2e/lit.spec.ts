import type { Locator, Page } from "@playwright/test";
import { contentPages, isPostPage, sitemapPages } from "./support/routes";
import { expect, test } from "./support/test";

/**
 * One hover grammar (styles/recipes.css, `lit`): a Writing row, a project
 * row and tile, the stage's title, a CV item, a pager item, the crumb and a
 * References row each light on hover, and again on its own link's keyboard
 * focus: the rule turns ink (`--rule-lit`), the title is underlined in the
 * text's ink, and an arrow turns ink and nudges. Focus on a link nested in
 * a row (a tag) leaves the row unlit. A module that set its own resting
 * `text-decoration` or arrow colour would win over the recipe (modules are
 * unlayered), so each family is checked in the browser.
 */

interface Lit {
    /** The element whose top rule lights, when it has one. */
    row?: Locator;
    /** The element underlined when lit. */
    title: Locator;
    /** What keyboard focus lands on: the title link, or the row itself. */
    link: Locator;
    arrow?: Locator;
}

/** A colour as the browser computes it, read through a probe. */
function colour(page: Page, value: string): Promise<string> {
    return page.evaluate((css) => {
        const probe = document.createElement("i");
        probe.style.color = css;
        document.body.append(probe);
        const computed = getComputedStyle(probe).color;
        probe.remove();
        return computed;
    }, value);
}

/** Focus by keyboard: the link, then back and forth with Tab, so focus
 *  arrives as a keyboard user's does (`:focus-visible`). */
async function tabTo(page: Page, link: Locator) {
    await link.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(link).toBeFocused();
    expect(await link.evaluate((el) => el.matches(":focus-visible"))).toBe(
        true,
    );
}

async function expectLit(page: Page, lit: Lit) {
    const ink = await colour(page, "var(--text)");
    const rule = await colour(page, "var(--rule-lit)");
    if (lit.row) await expect(lit.row).toHaveCSS("border-top-color", rule);
    await expect(lit.title).toHaveCSS("text-decoration-line", "underline");
    await expect(lit.title).toHaveCSS("text-decoration-color", ink);
    if (lit.arrow) {
        await expect(lit.arrow).toHaveCSS("color", ink);
        await expect(lit.arrow).not.toHaveCSS("transform", "none");
        await expect(lit.arrow).not.toHaveCSS(
            "transform",
            "matrix(1, 0, 0, 1, 0, 0)",
        );
    }
}

async function expectUnlit(page: Page, lit: Lit) {
    const rule = await colour(page, "var(--rule-lit)");
    const quiet = await colour(page, "var(--icon-quiet)");
    if (lit.row) await expect(lit.row).not.toHaveCSS("border-top-color", rule);
    await expect(lit.title).toHaveCSS(
        "text-decoration-color",
        "rgba(0, 0, 0, 0)",
    );
    if (lit.arrow) await expect(lit.arrow).toHaveCSS("color", quiet);
}

/** Hover the row (or the title where there is no row), then, with the
 *  pointer away, focus its link by keyboard. */
async function checkFamily(page: Page, lit: Lit) {
    await page.mouse.move(0, 0);
    await lit.title.scrollIntoViewIfNeeded();
    await expectUnlit(page, lit);
    await (lit.row ?? lit.link).hover();
    await expectLit(page, lit);
    await page.mouse.move(0, 0);
    await expectUnlit(page, lit);
    await tabTo(page, lit.link);
    await expectLit(page, lit);
}

const main = (page: Page) => page.getByRole("main");

/** /blog's entry rows: the list items with a heading. */
function writingRows(page: Page) {
    return main(page)
        .getByRole("listitem")
        .filter({ has: page.getByRole("heading") });
}

function writingRow(row: Locator): Lit {
    const title = row.getByRole("heading").getByRole("link");
    return { row, title, link: title, arrow: row.locator(".lit__arrow") };
}

test("a Writing row lights on hover and on its title's focus", async ({
    page,
}) => {
    await page.goto("/blog");
    const row = writingRows(page).first();
    await expect(row).toBeVisible();
    await checkFamily(page, writingRow(row));
});

test("a tag's focus in a Writing row leaves the row unlit", async ({
    page,
}) => {
    await page.goto("/blog");
    await expect(writingRows(page).first()).toBeVisible();
    const tag = page.locator('a[href^="/blog/tags/"]');
    const tagged = writingRows(page).filter({ has: tag });
    test.skip((await tagged.count()) === 0, "No row on this build has a tag.");
    const row = tagged.first();
    await page.mouse.move(0, 0);
    await tabTo(page, row.locator(tag).first());
    await expectUnlit(page, writingRow(row));
});

test("a project row and a tile light on hover and on their title's focus", async ({
    page,
}) => {
    await page.goto("/portfolio");
    // The stage lights its title alone (below); a tile and a row as one.
    const tiles = main(page).locator("article.lit");
    const rows = main(page).locator("li.lit");
    expect(await tiles.count(), "tiles on /portfolio").toBeGreaterThan(0);
    expect(await rows.count(), "rows on /portfolio").toBeGreaterThan(0);
    for (const row of [rows.first(), tiles.first()]) {
        const title = row.getByRole("heading").getByRole("link");
        await checkFamily(page, {
            row,
            title,
            link: title,
            arrow: row.locator(".lit__arrow"),
        });
    }
});

test("the stage's title lights on hover and on its focus", async ({ page }) => {
    await page.goto("/");
    const title = main(page).getByRole("heading").locator("a.lit").first();
    await expect(title).toBeVisible();
    await checkFamily(page, {
        title,
        link: title,
        arrow: title.locator(".lit__arrow"),
    });
});

test("a CV item lights on hover and on its title's focus", async ({ page }) => {
    await page.goto("/resume#cv");
    const row = main(page)
        .getByRole("listitem")
        .filter({ has: page.locator("a.lit__title") })
        .first();
    await expect(row).toBeVisible();
    const title = row.getByRole("heading").getByRole("link");
    await checkFamily(page, { row, title, link: title });
});

test("a pager item and the crumb light on hover and on their focus", async ({
    page,
    request,
}) => {
    const posts = (await sitemapPages(request)).filter(isPostPage);
    expect(posts.length, "posts in the sitemap").toBeGreaterThan(1);
    await page.goto(posts[0]);
    const crumb = main(page).getByRole("link", {
        name: "Writing",
        exact: true,
    });
    await checkFamily(page, { title: crumb, link: crumb });
    const item = main(page).locator("a.lit:has(.lit__title)").first();
    await checkFamily(page, {
        row: item,
        title: item.locator(".lit__title"),
        link: item,
    });
});

test("a References row lights on hover and on its focus", async ({
    page,
    request,
}, testInfo) => {
    const projects = (await contentPages(request, testInfo)).filter((path) =>
        path.startsWith("/portfolio/"),
    );
    let found = false;
    for (const path of projects) {
        await page.goto(path);
        const references = main(page).getByRole("navigation", {
            name: "References",
        });
        if (!(await references.count())) continue;
        found = true;
        const row = references.getByRole("link").first();
        await checkFamily(page, {
            row,
            title: row.locator(".lit__title"),
            link: row,
            arrow: row.locator(".lit__arrow"),
        });
        break;
    }
    // The fixture build's essay fixture has one; real content may not.
    test.skip(
        !found && testInfo.project.name !== "fixture",
        "No project on this build has a References section.",
    );
    expect(found, "a project with a References section").toBe(true);
});
