import type { Page } from "@playwright/test";
import { missionsCopy as copy, pagerCopy } from "@/lib/copy";
import { expect, test } from "./support/test";
import { sitemapPages } from "./support/routes";

/**
 * Projects (G5; plan §6.2 PR 12, contract §9; premium WS2): /portfolio
 * sends the fragments its old sections had on to their pages and links
 * every project's page, the flagship first and the owner's last project
 * least prominent, with no counts, register or related pages; no project
 * name is set in capitals, and a card lists at most four stack items; a
 * cover leads its card, carries its caption as a credit, opens the project
 * and stays a thumbnail smaller than the stage's photograph (checked where
 * the build has covers; the fixtures have none); the quieter rows carry no
 * "Also" label.
 * Each project page has its crumb (Projects alone: no number or name),
 * its title as the heading and the pager ("Previous", "Next", in the
 * index's order), with no close, title block or revision stamp; a project
 * with little content is a short note with no sections, and a module the
 * owner has not filled in is absent. On the fixture build a fully filled
 * mission shows every module (the overview, the results opening on their
 * first row, the retrospective), its repository beside Read the write-up
 * in the head and its callouts as plain rows, and no Related writing that
 * would only repeat the original entry; a planned one shows none of them.
 * Projects are read from the sitemap, so the spec fits fixture and real
 * content alike.
 */

function main(page: Page) {
    return page.getByRole("main");
}

async function missionPaths(page: Page): Promise<string[]> {
    const paths = await sitemapPages(page.request);
    return paths.filter((path) => /^\/portfolio\/[^/]+$/.test(path));
}

test("/portfolio sends every old fragment on to its page", async ({ page }) => {
    // The fragment → where that section lives now.
    const moved: [fragment: string, url: RegExp][] = [
        ["experience", /\/resume#experience$/],
        ["skills", /\/resume#skills$/],
        ["certifications", /\/resume#certifications$/],
        ["engineering-writing", /\/blog$/],
        ["contact", /\/contact$/],
    ];
    for (const [fragment, url] of moved) {
        await page.goto(`/portfolio#${fragment}`);
        await expect(page, fragment).toHaveURL(url);
    }
    await page.goto("/portfolio#skills");
    await expect(main(page).locator("#skills")).toBeInViewport();

    await page.goto("/portfolio#projects");
    await expect(page).toHaveURL(/\/portfolio#projects$/);
    await expect(main(page).locator("#projects")).toBeInViewport();
    await expect(
        main(page).locator("#projects").getByRole("article").first(),
    ).toBeInViewport();
});

test("/portfolio links every project, the flagship first and the last project quietest", async ({
    page,
}) => {
    const paths = await missionPaths(page);
    await page.goto("/portfolio");
    // The flagship's title is its one link to the page: no filled button
    // repeats it.
    const stage = main(page).getByRole("article").first();
    await expect(stage.getByRole("heading").getByRole("link")).toHaveCount(
        paths.length ? 1 : 0,
    );
    await expect(main(page).locator(".btn--primary")).toHaveCount(0);
    for (const path of paths) {
        await expect(
            main(page).locator(`a[href="${path}"]`).first(),
            path,
        ).toBeAttached();
    }
    // No derived counts, no register, no mission numbers on the index,
    // and no related pages repeating the nav.
    await expect(main(page).getByRole("table")).toHaveCount(0);
    await expect(main(page)).not.toContainText(/MSN-\d+/);
    await expect(main(page).locator(".page-head .status")).toHaveCount(0);
    await expect(main(page).getByRole("navigation")).toHaveCount(0);
    // The tiers' sections are named for screen readers only, and the
    // quieter rows carry no "Also" label: space and a hairline set them
    // apart.
    for (const name of [copy.flagship, copy.more]) {
        await expect(
            main(page).getByRole("heading", { name, exact: true }),
        ).toHaveClass(/sr-only/);
    }
    await expect(main(page).getByText("Also", { exact: true })).toHaveCount(0);
    // Titles in sentence case, and a card lists four stack items at most.
    for (const heading of await main(page)
        .getByRole("article")
        .getByRole("heading")
        .all()) {
        await expect(heading).toHaveCSS("text-transform", "none");
    }
    for (const stack of await main(page)
        .getByRole("list", { name: copy.stack })
        .all()) {
        expect(await stack.locator("li").count()).toBeLessThanOrEqual(4);
    }
});

test("a cover leads its card, credited, and opens the project", async ({
    page,
}) => {
    await page.goto("/portfolio");
    const more = main(page).locator("#projects");
    if (!(await more.count())) return;
    // The fixtures carry no images; a build with covers is checked.
    const covers = await more.evaluate((section) =>
        [...section.querySelectorAll("article, li")]
            .filter((card) => card.querySelector(":scope > figure"))
            .map((card) => {
                const figure = card.querySelector(":scope > figure")!;
                const image = figure.querySelector("img")!;
                image.scrollIntoView({ behavior: "instant", block: "center" });
                const box = image.getBoundingClientRect();
                const hit = document.elementFromPoint(
                    box.x + box.width / 2,
                    box.y + box.height / 2,
                );
                const credit = figure.querySelector("figcaption .caption__src");
                return {
                    first: card.firstElementChild === figure,
                    caption: figure.querySelector("figcaption")?.textContent,
                    credit: credit?.textContent ?? null,
                    font: credit ? getComputedStyle(credit).fontFamily : "",
                    opens: hit?.closest("a")?.getAttribute("href") ?? null,
                    href: card
                        .querySelector(":is(h3, h4) a")
                        ?.getAttribute("href"),
                };
            }),
    );
    for (const cover of covers) {
        expect(cover.first).toBe(true);
        expect(cover.opens).toBe(cover.href);
        if (cover.caption) {
            expect(cover.credit).toBe(cover.caption);
            expect(cover.font).toMatch(/Mono/);
        }
    }
});

for (const width of [390, 768, 960, 1440, 1920]) {
    test(`a tile's cover is a credited thumbnail, smaller than the stage's plate, at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/portfolio");
        // The fixtures carry no images; a build with covers is checked.
        const plates = await main(page).evaluate((section) => {
            const size = (figure: Element | null) => {
                const box = figure
                    ?.querySelector("img")
                    ?.getBoundingClientRect();
                return {
                    width: box?.width ?? 0,
                    area: box ? box.width * box.height : 0,
                };
            };
            return {
                stage: size(
                    section.querySelector(
                        "section:not(#projects) article figure",
                    ),
                ),
                cards: [
                    ...section.querySelectorAll(
                        "#projects :is(article, li) > figure",
                    ),
                ].map(size),
            };
        });
        // The owner's photograph stays the page's largest image: each
        // cover is narrower, and the covers together are smaller.
        if (!plates.stage.area) return;
        const covers = plates.cards.reduce((sum, card) => sum + card.area, 0);
        expect(covers).toBeLessThan(plates.stage.area);
        for (const card of plates.cards) {
            expect(card.width).toBeLessThan(plates.stage.width);
        }
    });
}

test("/portfolio shows the flagship's title, its link, in the first viewport", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/portfolio");
    const stage = main(page).getByRole("article").first();
    const title = stage.getByRole("heading").getByRole("link");
    await expect(title).toBeInViewport({ ratio: 1 });
    const box = await title.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(760);
});

test("every project page has its crumb, title and pager", async ({ page }) => {
    const paths = await missionPaths(page);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
        await test.step(path, async () => {
            await page.goto(path);
            // The crumb is the section alone, as a post's: the h1 names
            // the project, and no number is printed.
            await expect(main(page).locator(".crumb-row")).toHaveText(
                copy.plain,
            );
            await expect(main(page)).not.toContainText(/MSN-\d+/);
            const heading = main(page).getByRole("heading", { level: 1 });
            await expect(heading).toHaveCount(1);
            await expect(heading).toHaveCSS("text-transform", "none");
            // No jump to the page's own write-up, and no "Table 1".
            await expect(main(page).locator('a[href="#write-up"]')).toHaveCount(
                0,
            );
            await expect(main(page)).not.toContainText(/\bTable 1\b/);
            // A stack item never splits across lines.
            for (const item of await main(page)
                .getByRole("list", { name: copy.stack })
                .locator("li")
                .all()) {
                await expect(item).toHaveCSS("white-space", "nowrap");
            }
            // The pager: the neighbouring projects only, "Previous" or
            // "Next" then the name (the crumb leads back to all of them).
            const pager = main(page).getByRole("navigation", {
                name: copy.pagerLabel,
            });
            await expect(pager.getByRole("link").first()).toHaveAttribute(
                "href",
                /^\/portfolio\/[^/]+$/,
            );
            for (const link of await pager.getByRole("link").all()) {
                await expect(link).toContainText(
                    new RegExp(
                        `^(${pagerCopy.previous}|${pagerCopy.next})(?! project)`,
                    ),
                );
            }
            await expect(
                main(page).locator(".crumb-row").getByRole("link", {
                    name: copy.plain,
                }),
            ).toHaveAttribute("href", "/portfolio");
            // No close: the header's Contact is in every viewport.
            await expect(main(page).getByText(/^Questions about/)).toHaveCount(
                0,
            );
            await expect(
                main(page).getByRole("link", { name: "Send a message" }),
            ).toHaveCount(0);
            // No title block repeating the line, and no revision stamp.
            await expect(
                main(page)
                    .getByRole("term")
                    .filter({ hasText: /^(Mission|Revision)$/ }),
            ).toHaveCount(0);
            await expect(main(page)).not.toContainText(/\bRev \d{4}-/);
            // Nothing stands in for a value that is not set.
            await expect(main(page)).not.toContainText(
                /\bTBD\b|not published|placeholder/i,
            );
        });
    }
});

test("the pager follows the index's order", async ({ page }) => {
    await page.goto("/portfolio");
    const order = await main(page)
        .locator('a[href^="/portfolio/"]')
        .evaluateAll((links) => [
            ...new Set(
                links
                    .map((link) => link.getAttribute("href") ?? "")
                    .filter((href) => /^\/portfolio\/[^/#]+$/.test(href)),
            ),
        ]);
    expect(order.length).toBeGreaterThan(1);
    for (const [index, path] of order.entries()) {
        await page.goto(path);
        const pager = main(page).getByRole("navigation", {
            name: copy.pagerLabel,
        });
        const next = pager.getByRole("link", {
            name: new RegExp(`^${pagerCopy.next}`),
        });
        const previous = pager.getByRole("link", {
            name: new RegExp(`^${pagerCopy.previous}`),
        });
        if (index < order.length - 1) {
            await expect(next, path).toHaveAttribute("href", order[index + 1]);
        } else {
            await expect(next, path).toHaveCount(0);
        }
        if (index > 0) {
            await expect(previous, path).toHaveAttribute(
                "href",
                order[index - 1],
            );
        } else {
            await expect(previous, path).toHaveCount(0);
        }
    }
});

test("a project with little content is a short note, with no sections", async ({
    page,
}) => {
    const paths = await missionPaths(page);
    let notes = 0;
    for (const path of paths) {
        await page.goto(path);
        const root = main(page).locator("[data-page='mission']");
        if ((await root.getAttribute("data-layout")) !== "note") continue;
        notes += 1;
        await test.step(path, async () => {
            // The title is the heading; the summary, highlights and facts
            // follow without section heads (only related writing and an
            // essay that says more), stats or a write-up button. One
            // highlight is a plain paragraph, not a one-item list.
            for (const heading of await main(page)
                .getByRole("heading", { level: 2 })
                .allTextContents()) {
                expect([copy.related, copy.writeUp]).toContain(heading.trim());
            }
            await expect(main(page).locator(".metrics")).toHaveCount(0);
            await expect(main(page).locator(".btn")).toHaveCount(0);
            for (const list of await main(page)
                .locator("ul:not([aria-label])")
                .filter({ hasNot: page.getByRole("link") })
                .all()) {
                expect(
                    await list.locator(":scope > li").count(),
                    path,
                ).not.toBe(1);
            }
        });
    }
    // The published Kubernetes cluster (and its fixture) is a note, and
    // its title and highlights already name every stack item, so no Stack
    // row repeats them.
    expect(notes).toBeGreaterThan(0);
    await page.goto("/portfolio/kubernetes-cluster");
    await expect(
        main(page)
            .getByRole("term")
            .filter({ hasText: /^Stack$/ }),
    ).toHaveCount(0);
});

test("Read the write-up lands on the write-up", async ({ page }) => {
    const paths = await missionPaths(page);
    let checked = 0;
    for (const path of paths) {
        await page.goto(path);
        const link = main(page).getByRole("link", { name: copy.readWriteUp });
        if (!(await link.count())) continue;
        checked += 1;
        // The project's original Flight Log entry: the head never points
        // down to the page's own write-up.
        const href = (await link.getAttribute("href")) ?? "";
        expect(href).toMatch(/^\/blog\/[a-z0-9-]+$/);
        await link.click();
        await expect(page).toHaveURL(new RegExp(`${href}$`));
    }
    expect(checked).toBeGreaterThan(0);
});

test("the pages show no email address or phone number", async ({ page }) => {
    const paths = ["/portfolio", ...(await missionPaths(page))];
    for (const path of paths) {
        const html = await (await page.request.get(path)).text();
        expect(html, path).not.toMatch(/mailto:|tel:/i);
    }
});

const FIXTURE_ONLY =
    "Only the fixture missions are known to fill or skip each module.";

/** The mission file's modules, by their sections' ids. Its one link, the
 *  repository, is the head's, not a References section; its only post is
 *  the original entry, which the head links, so it has no Related
 *  writing. */
const MODULES = ["callouts", "brief", "write-up", "results", "debrief"];

test.describe("on the fixture build", () => {
    test("a filled mission shows every module, its callouts as plain rows", async ({
        page,
    }, testInfo) => {
        test.skip(testInfo.project.name !== "fixture", FIXTURE_ONLY);
        await page.goto("/portfolio/fixture-flagship-mission");
        for (const id of MODULES) {
            await expect(
                main(page)
                    .getByRole("region")
                    .and(main(page).locator(`#${id}`)),
                id,
            ).toHaveCount(1);
        }
        await expect(main(page).locator("#links")).toHaveCount(0);
        await expect(main(page).locator("#related")).toHaveCount(0);
        // The brief is the Overview (its rows name problem, approach and
        // outcome); lessons and next steps both share a plain title.
        await expect(
            main(page).getByRole("heading", { level: 2, name: copy.overview }),
        ).toBeVisible();
        await expect(
            main(page).getByRole("heading", {
                level: 2,
                name: copy.retrospective,
            }),
        ).toBeVisible();
        for (const name of [copy.lessons, copy.nextSteps]) {
            await expect(
                main(page).getByRole("heading", { level: 3, name }),
            ).toBeVisible();
        }
        // The callouts: plain rows under "Parts of the build", no links.
        const callouts = main(page).getByRole("region", {
            name: copy.callouts,
        });
        await expect(callouts.getByRole("listitem")).toHaveCount(2);
        await expect(callouts.getByRole("link")).toHaveCount(0);
        // The repository is the head's, beside Read the write-up, and no
        // facts row labels it.
        const head = main(page)
            .locator("header")
            .filter({
                has: page.getByRole("heading", { level: 1 }),
            });
        await expect(
            head.getByRole("link", { name: "Fixture repository" }),
        ).toHaveAttribute("href", "https://example.com/fixture-repository");
        await expect(
            main(page)
                .getByRole("term")
                .filter({ hasText: /^Code$/ }),
        ).toHaveCount(0);
        // Read the write-up goes to the original entry, once, quietly.
        const writeUp = main(page).getByRole("link", {
            name: copy.readWriteUp,
        });
        await expect(writeUp).toHaveAttribute(
            "href",
            "/blog/fixture-post-code-and-links",
        );
        await expect(writeUp).not.toHaveClass(/btn/);
        // The results table is named by its section's heading, and opens
        // on its first row: the column heads are for screen readers.
        const table = main(page).getByRole("table", { name: copy.results });
        await expect(table).toBeVisible();
        await expect(table.getByRole("columnheader")).toHaveText([
            copy.resultColumns.metric,
            copy.resultColumns.value,
            copy.resultColumns.note,
        ]);
        const thead = await table.locator("thead").boundingBox();
        expect(thead?.height ?? 0).toBeLessThanOrEqual(1);
    });

    test("a planned mission leaves out what it does not have", async ({
        page,
    }, testInfo) => {
        test.skip(testInfo.project.name !== "fixture", FIXTURE_ONLY);
        await page.goto("/portfolio/fixture-planned-mission");
        for (const id of MODULES.filter((module) => module !== "write-up")) {
            await expect(main(page).locator(`#${id}`), id).toHaveCount(0);
        }
        await expect(
            main(page)
                .getByRole("term")
                .filter({ hasText: /^Dates$/ }),
        ).toHaveCount(0);
        await expect(
            main(page).getByRole("link", { name: copy.readWriteUp }),
        ).toHaveCount(0);
    });
});
