import type { APIRequestContext, Page } from "@playwright/test";
import { missionsCopy as copy, pagerCopy } from "@/lib/copy";
import { FIXTURE_PROJECTS } from "@/lib/fixtures";
import { expect, test } from "./support/test";
import { isPostPage, sitemapPages } from "./support/routes";

/**
 * Projects (G5; plan §6.2 PR 12, contract §9; premium WS2): /portfolio
 * sends the fragments its old sections had on to their pages and links
 * every project's page, the flagship first and the owner's last project
 * least prominent, with no counts, register or related pages; no project
 * name is set in capitals, and a card lists at most four stack items; a
 * card reads its line, then its title, then its cover (drawn beside the
 * title) and the cover's credit; a cover carries its caption as a
 * credit, opens the project
 * and stays a thumbnail smaller than the stage's photograph (checked where
 * the build has covers; the fixtures have none); the quieter rows carry no
 * "Also" label, and a row alone in its list (home's, /portfolio's, a
 * post's Related project) spans the list from 960px, its summary beside
 * its title, as a lone tile does.
 * Each project page has its crumb (Projects alone: no number or name),
 * its title as the heading and the pager ("Previous", "Next", in mission
 * order: the index's, but a quiet project keeps its slot's place), with
 * no close, title block or revision stamp; a project
 * with little content is a short note with no sections, and a module the
 * owner has not filled in is absent. On the fixture build a fully filled
 * mission shows every module (the overview, the results opening on their
 * first row, the retrospective), its repository beside Read the write-up
 * in the head and its callouts as plain rows, and no Related writing that
 * would only repeat the original entry; a planned one shows none of them,
 * and, quiet in a featured slot, is a quiet row whose pager keeps its
 * mission order. Projects are read from the sitemap, so the spec fits
 * fixture and real content alike.
 */

function main(page: Page) {
    return page.getByRole("main");
}

async function missionPaths(request: APIRequestContext): Promise<string[]> {
    const paths = await sitemapPages(request);
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
    request,
}) => {
    const paths = await missionPaths(request);
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

test("a cover follows its card's title, credited, and opens the project", async ({
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
                const heading = card.querySelector(":scope > :is(h2, h3, h4)");
                const credit = figure.querySelector("figcaption .caption__src");
                const title = heading?.getBoundingClientRect();
                return {
                    // In the source after the title, drawn beside it.
                    afterTitle: Boolean(
                        heading &&
                        heading.compareDocumentPosition(figure) &
                            Node.DOCUMENT_POSITION_FOLLOWING,
                    ),
                    beside: Boolean(
                        title &&
                        box.top < title.bottom &&
                        box.bottom > title.top,
                    ),
                    caption: figure.querySelector("figcaption")?.textContent,
                    credit: credit?.textContent ?? null,
                    font: credit ? getComputedStyle(credit).fontFamily : "",
                    opens: hit?.closest("a")?.getAttribute("href") ?? null,
                    href: heading?.querySelector("a")?.getAttribute("href"),
                };
            }),
    );
    for (const cover of covers) {
        expect(cover.afterTitle).toBe(true);
        expect(cover.beside).toBe(true);
        expect(cover.opens).toBe(cover.href);
        if (cover.caption) {
            expect(cover.credit).toBe(cover.caption);
            expect(cover.font).toMatch(/Mono/);
        }
    }
});

for (const [path, width] of [
    ["/portfolio", 1440],
    ["/portfolio", 390],
    ["/", 1440],
    ["/", 390],
] as const) {
    test(`a project card on ${path} reads its title before its cover's credit at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        // Every card: the stage and the tiles (articles), the rows (list
        // items holding a heading).
        const cards = main(page)
            .getByRole("article")
            .or(
                main(page)
                    .getByRole("listitem")
                    .filter({ has: page.getByRole("heading") }),
            )
            .filter({ has: page.locator('a[href^="/portfolio/"]') });
        const count = await cards.count();
        expect(count).toBeGreaterThan(0);
        for (let i = 0; i < count; i++) {
            const card = cards.nth(i);
            const title = card.getByRole("heading").first();
            const titleText = (await title.innerText()).trim();
            const text = await card.innerText();
            const before = text.slice(0, text.indexOf(titleText));
            expect(text.indexOf(titleText), titleText).toBeGreaterThanOrEqual(
                0,
            );
            // Only the line (● Status · dates) comes before the title: one
            // or two short lines, never the cover or its credit.
            expect(
                before.trim().split(/\n+/).length,
                titleText,
            ).toBeLessThanOrEqual(2);
            for (const figure of await card.getByRole("figure").all()) {
                const caption = (await figure.innerText()).trim();
                if (caption) {
                    expect(before, titleText).not.toContain(caption);
                    expect(text.indexOf(caption), titleText).toBeGreaterThan(
                        text.indexOf(titleText),
                    );
                }
                // Not by role: a cover without alt text is presentational.
                const image = figure.locator("img");
                const alt = await image.getAttribute("alt");
                // The image itself follows the title in the source.
                const follows = await title.evaluate(
                    (heading, img) =>
                        Boolean(
                            img &&
                            heading.compareDocumentPosition(img) &
                                Node.DOCUMENT_POSITION_FOLLOWING,
                        ),
                    await image.elementHandle(),
                );
                expect(follows, `${titleText}: ${alt}`).toBe(true);
            }
        }
    });
}

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

test("a lone project row spans its list from 960px, its summary beside its title", async ({
    page,
    request,
}, testInfo) => {
    // Home's rows, /portfolio's quiet rows and a post's Related project:
    // a row alone in its list takes the list's width, as a lone tile
    // does, and two or more go two across.
    const posts = (await sitemapPages(request)).filter(isPostPage);
    let lone = 0;
    for (const path of ["/", "/portfolio", ...posts]) {
        await page.goto(path);
        for (const width of [960, 1440, 1920]) {
            await page.setViewportSize({ width, height: 900 });
            const lists = await main(page).evaluate((root) => {
                const heading = ":scope > :is(h3, h4)";
                const project = `${heading} > a[href^="/portfolio/"]`;
                const summary = `${heading} ~ p`;
                const rect = (element: Element | null) =>
                    element?.getBoundingClientRect();
                // A list of project rows: every item's heading links a
                // project.
                return [...root.querySelectorAll("ul")]
                    .filter(
                        (list) =>
                            list.getClientRects().length > 0 &&
                            list.children.length > 0 &&
                            [...list.children].every((item) =>
                                item.querySelector(project),
                            ),
                    )
                    .map((list) => ({
                        width: list.getBoundingClientRect().width,
                        rows: [...list.children].map((item) => {
                            const title = rect(item.querySelector(heading))!;
                            const text = rect(item.querySelector(summary));
                            return {
                                width: item.getBoundingClientRect().width,
                                // Right of the title, and level with it.
                                beside: text
                                    ? text.left > title.right &&
                                      text.top < title.bottom
                                    : null,
                            };
                        }),
                    }));
            });
            for (const list of lists) {
                const where = `${path} at ${width}px`;
                if (list.rows.length > 1) {
                    for (const row of list.rows) {
                        expect(row.width, where).toBeLessThan(list.width / 2);
                    }
                    continue;
                }
                const [row] = list.rows;
                lone += 1;
                expect(row.width, where).toBeCloseTo(list.width, 0);
                if (row.beside !== null) expect(row.beside, where).toBe(true);
            }
        }
    }
    // The fixture build has one: a fixture post's one related project.
    if (testInfo.project.name === "fixture") {
        expect(lone, "lone rows checked").toBeGreaterThan(0);
    }
});

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

test("every project page has its crumb, title and pager", async ({
    page,
    request,
}) => {
    const paths = await missionPaths(request);
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

test("the pager follows the index's order, a quiet row's project in its mission order", async ({
    page,
}, testInfo) => {
    await page.goto("/portfolio");
    /** The distinct project pages linked under `selector`, in order. */
    const linked = (selector: string) =>
        main(page)
            .locator(selector)
            .evaluateAll((links) => [
                ...new Set(
                    links
                        .map((link) => link.getAttribute("href") ?? "")
                        .filter((href) => /^\/portfolio\/[^/#]+$/.test(href)),
                ),
            ]);
    // The stage and the tiles, then the quiet rows.
    const featured = await linked('article a[href^="/portfolio/"]');
    const rows = await linked('#projects li a[href^="/portfolio/"]');
    const listed = [...featured, ...rows];
    expect(listed.length).toBeGreaterThan(1);

    const sides = new Map<
        string,
        { previous: string | null; next: string | null }
    >();
    for (const path of listed) {
        await page.goto(path);
        const pager = main(page).getByRole("navigation", {
            name: copy.pagerLabel,
        });
        const side = async (name: string) => {
            const link = pager.getByRole("link", {
                name: new RegExp(`^${name}`),
            });
            return (await link.count()) ? link.getAttribute("href") : null;
        };
        const previous = await side(pagerCopy.previous);
        const next = await side(pagerCopy.next);
        sides.set(path, { previous, next });
        // A lone side takes the whole width, so its hairline closes the
        // page across the measure, not over half of it.
        if (!previous || !next) {
            const lone = await pager.getByRole("link").boundingBox();
            const whole = await pager.boundingBox();
            expect(lone!.width, path).toBeCloseTo(whole!.width, 0);
        }
    }

    // One chain through every listed project, each Next undone by the
    // next page's Previous.
    const firsts = listed.filter((path) => !sides.get(path)!.previous);
    expect(firsts).toHaveLength(1);
    const chain: string[] = [];
    for (
        let path: string | null = firsts[0];
        path && chain.length <= listed.length;
        path = sides.get(path)?.next ?? null
    ) {
        chain.push(path);
    }
    expect([...chain].sort()).toEqual([...listed].sort());
    for (const [index, path] of chain.entries()) {
        expect(sides.get(path)!.previous, path).toBe(chain[index - 1] ?? null);
    }
    // The pager goes in mission order, as the index does: the stage and
    // the tiles keep its order, and so do the quiet rows.
    expect(chain.filter((path) => featured.includes(path))).toEqual(featured);
    expect(chain.filter((path) => rows.includes(path))).toEqual(rows);
    // Only a quiet project, listed among the rows whatever its slot, may
    // sit earlier in the pager. The fixture build's quiet projects are
    // known: without them, the pager and the index match exactly.
    if (testInfo.project.name === "fixture") {
        const quiet = new Set(
            FIXTURE_PROJECTS.filter((project) => project.quiet).map(
                (project) => `/portfolio/${project.slug}`,
            ),
        );
        expect(quiet.size).toBeGreaterThan(0);
        const loud = (paths: string[]) =>
            paths.filter((path) => !quiet.has(path));
        expect(loud(chain)).toEqual(loud(listed));
    }
});

test("a project with little content is a short note, with no sections", async ({
    page,
    request,
}) => {
    const paths = await missionPaths(request);
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

test("Read the write-up lands on the write-up", async ({ page, request }) => {
    const paths = await missionPaths(request);
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

test("the pages show no email address or phone number", async ({ request }) => {
    const paths = ["/portfolio", ...(await missionPaths(request))];
    for (const path of paths) {
        const html = await (await request.get(path)).text();
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

    test("a quiet mission is a quiet row, though it holds a featured slot", async ({
        page,
    }, testInfo) => {
        test.skip(testInfo.project.name !== "fixture", FIXTURE_ONLY);
        const quiet = FIXTURE_PROJECTS.find((project) => project.quiet)!;
        const href = `/portfolio/${quiet.slug}`;
        await page.goto("/portfolio");
        // Not the stage or a tile: the next projects fill both tiles, and
        // it leads the quiet rows, first of them in mission order.
        await expect(
            main(page).locator(`article a[href="${href}"]`),
        ).toHaveCount(0);
        await expect(main(page).locator("#projects article")).toHaveCount(2);
        await expect(
            main(page).locator('#projects li a[href^="/portfolio/"]').first(),
        ).toHaveAttribute("href", href);
        // Its page is as any other's, and the pager keeps its slot's
        // place: right after slot 2.
        await page.goto(href);
        await expect(main(page).getByRole("heading", { level: 1 })).toHaveText(
            quiet.title,
        );
        const before = FIXTURE_PROJECTS.find(
            (project) => project.featured === quiet.featured! - 1,
        )!;
        await expect(
            main(page)
                .getByRole("navigation", { name: copy.pagerLabel })
                .getByRole("link", {
                    name: new RegExp(`^${pagerCopy.previous}`),
                }),
        ).toHaveAttribute("href", `/portfolio/${before.slug}`);
    });

    test("an essay's contents mark the section being read as an entry's do", async ({
        page,
    }, testInfo) => {
        test.skip(testInfo.project.name !== "fixture", FIXTURE_ONLY);
        await page.goto("/portfolio/portable-text-project-fixture");
        const second = main(page)
            .getByRole("navigation", { name: copy.contentsLabel })
            .getByRole("link")
            .nth(1);
        await second.click();
        await page.mouse.move(0, 0);
        await expect(second).toHaveAttribute("aria-current", "location");
        // The 2px orange bar of post.module.css (once its colour has
        // eased in), not a rule under the link.
        await expect
            .poll(() =>
                second.evaluate((link) => {
                    const probe = document.createElement("i");
                    probe.style.color = "var(--accent)";
                    link.append(probe);
                    const accent = getComputedStyle(probe).color;
                    probe.remove();
                    const style = getComputedStyle(link);
                    return {
                        bar: style.borderLeftColor === accent,
                        width: style.borderLeftWidth,
                        line: style.textDecorationLine,
                    };
                }),
            )
            .toEqual({ bar: true, width: "2px", line: "none" });
    });
});
