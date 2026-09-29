import type { Page } from "@playwright/test";
import { missionsCopy as copy } from "@/lib/copy";
import { missionName } from "@/lib/missions";
import { expect, test } from "./support/test";
import { sitemapPages } from "./support/routes";

/**
 * Projects (G5; plan §6.2 PR 12, contract §9): /portfolio keeps answering
 * the fragments its old sections had and links every project's page, the
 * flagship first and the owner's last project least prominent, with no
 * counts or register. Each project page has its crumb, title, close and
 * pager, and no title block or revision stamp; a project with little
 * content is a short note with no sections, and a module the owner has not
 * filled in is absent. On the fixture build a fully filled mission shows
 * every module and its callouts link to the right sections, and a planned
 * one shows none of them. Projects are read from the sitemap, so the spec
 * fits fixture and real content alike.
 */

function main(page: Page) {
    return page.getByRole("main");
}

async function missionPaths(page: Page): Promise<string[]> {
    const paths = await sitemapPages(page.request);
    return paths.filter((path) => /^\/portfolio\/[^/]+$/.test(path));
}

test("/portfolio still answers every old fragment", async ({ page }) => {
    // The fragment → where that section lives now.
    const moved: [fragment: string, href: RegExp][] = [
        ["experience", /^\/resume#experience$/],
        ["skills", /^\/resume#skills$/],
        ["certifications", /^\/resume#certifications$/],
        ["engineering-writing", /^\/blog$/],
        ["contact", /^\/contact$/],
    ];
    await page.goto("/portfolio");
    for (const [fragment, href] of moved) {
        const row = main(page).locator(`#${fragment}`);
        await expect(row, fragment).toHaveCount(1);
        await expect(row.getByRole("link"), fragment).toHaveAttribute(
            "href",
            href,
        );
    }
    await page.goto("/portfolio#projects");
    await expect(main(page).locator("#projects")).toBeInViewport();
    await expect(
        main(page).getByRole("heading", { name: copy.more, exact: true }),
    ).toBeInViewport();

    await page.goto("/portfolio#skills");
    await expect(main(page).locator("#skills")).toBeInViewport();
});

test("/portfolio links every project, the flagship first and the last project quietest", async ({
    page,
}) => {
    const paths = await missionPaths(page);
    await page.goto("/portfolio");
    const links = main(page).getByRole("link", {
        name: copy.openFile,
    });
    await expect(links).toHaveCount(paths.length ? 1 : 0);
    for (const path of paths) {
        await expect(
            main(page).locator(`a[href="${path}"]`).first(),
            path,
        ).toBeAttached();
    }
    // No derived counts, no register, no mission numbers on the index.
    await expect(main(page).getByRole("table")).toHaveCount(0);
    await expect(main(page)).not.toContainText(/MSN-\d+/);
    await expect(main(page).locator(".page-head .status")).toHaveCount(0);
});

test("every project page has its crumb, title, close and pager", async ({
    page,
}) => {
    const paths = await missionPaths(page);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
        await test.step(path, async () => {
            await page.goto(path);
            const name = missionName(path.split("/").pop()!);
            // The crumb names the project, with its number as its one
            // quiet identifier.
            await expect(main(page).getByText(/^MSN-\d{2}$/)).toHaveCount(1);
            await expect(main(page).getByText(name).first()).toBeVisible();
            await expect(
                main(page).getByRole("heading", { level: 1 }),
            ).toHaveCount(1);
            const pager = main(page).getByRole("navigation", {
                name: copy.pagerLabel,
            });
            await expect(
                pager.getByRole("link", { name: copy.all }),
            ).toHaveAttribute("href", "/portfolio");
            await expect(
                main(page).getByRole("link", { name: copy.getInTouch }),
            ).toHaveAttribute("href", "/contact#hello");
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
            // follow without section heads (only related writing, an essay
            // that says more, and the close), stats or a write-up button.
            for (const heading of await main(page)
                .getByRole("heading", { level: 2 })
                .allTextContents()) {
                expect([copy.related, copy.writeUp, copy.question]).toContain(
                    heading.trim(),
                );
            }
            await expect(main(page).locator(".metrics")).toHaveCount(0);
            await expect(
                main(page).getByRole("link", { name: copy.readWriteUp }),
            ).toHaveCount(0);
            await expect(
                main(page)
                    .getByRole("term")
                    .filter({ hasText: /^Stack$/ }),
            ).toHaveCount(1);
        });
    }
    // The published Kubernetes cluster (and its fixture) is a note.
    expect(notes).toBeGreaterThan(0);
});

test("Read the write-up lands on the write-up", async ({ page }) => {
    const paths = await missionPaths(page);
    let checked = 0;
    for (const path of paths) {
        await page.goto(path);
        const link = main(page).getByRole("link", { name: copy.readWriteUp });
        if (!(await link.count())) continue;
        checked += 1;
        const href = (await link.getAttribute("href")) ?? "";
        await link.click();
        if (href === "#write-up") {
            await expect(page).toHaveURL(/#write-up$/);
            await expect(
                main(page).getByRole("heading", {
                    name: copy.writeUp,
                    exact: true,
                }),
            ).toBeInViewport();
        } else {
            // The project's original Flight Log entry.
            expect(href).toMatch(/^\/blog\/[a-z0-9-]+$/);
            await expect(page).toHaveURL(new RegExp(`${href}$`));
        }
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

/** The mission file's modules, by their sections' ids. */
const MODULES = [
    "callouts",
    "brief",
    "write-up",
    "results",
    "debrief",
    "links",
    "related",
];

test.describe("on the fixture build", () => {
    test("a filled mission shows every module, its callouts linked", async ({
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
        await expect(
            main(page).getByRole("link", {
                name: /^Fixture callout to a post/,
            }),
        ).toHaveAttribute(
            "href",
            "/blog/fixture-post-code-and-links#fixture-section-in-a-post",
        );
        await expect(
            main(page).getByRole("link", {
                name: "Fixture callout to the essay",
            }),
        ).toHaveAttribute("href", "#fixture-section");
        // Read the write-up goes to the original entry.
        await expect(
            main(page).getByRole("link", { name: copy.readWriteUp }),
        ).toHaveAttribute("href", "/blog/fixture-post-code-and-links");
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
