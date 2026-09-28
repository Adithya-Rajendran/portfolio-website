import type { Page } from "@playwright/test";
import { missionsCopy as copy } from "@/lib/copy";
import { missionName } from "@/lib/missions";
import { expect, test } from "./support/test";
import { sitemapPages } from "./support/routes";

/**
 * Missions (G5, G6; plan §6.2 PR 12): /portfolio keeps answering the
 * fragments its old sections had, each mission file has its head, record
 * and pager, and a module the owner has not filled in is absent. On the
 * fixture build a fully filled mission shows every module and its callouts
 * link to the right sections, and a planned one shows none of them.
 * Missions are read from the sitemap, so the spec fits fixture and real
 * content alike.
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
        main(page).getByRole("heading", { name: new RegExp(copy.morePlain) }),
    ).toBeInViewport();

    await page.goto("/portfolio#skills");
    await expect(main(page).locator("#skills")).toBeInViewport();
});

test("the register lists every mission with its file", async ({ page }) => {
    const paths = await missionPaths(page);
    await page.goto("/portfolio");
    const register = main(page).getByRole("table", {
        name: new RegExp(copy.registerCaption),
    });
    await expect(register.getByRole("row")).toHaveCount(paths.length + 1);
    for (const path of paths) {
        await expect(
            register.getByRole("link", {
                name: missionName(path.split("/").pop()!),
                exact: true,
            }),
        ).toHaveAttribute("href", path);
    }
});

test("every mission file has its head, record and pager", async ({ page }) => {
    const paths = await missionPaths(page);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
        await test.step(path, async () => {
            await page.goto(path);
            const name = missionName(path.split("/").pop()!);
            await expect(
                main(page).getByRole("heading", { level: 1 }),
            ).toContainText(name);
            await expect(
                main(page)
                    .getByRole("term")
                    .filter({ hasText: /^Mission$/ }),
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
            // Nothing stands in for a value that is not set.
            await expect(main(page)).not.toContainText(
                /\bTBD\b|not published|placeholder/i,
            );
        });
    }
});

test("Read the write-up lands on the write-up", async ({ page }) => {
    const [path] = await missionPaths(page);
    await page.goto(path);
    await main(page).getByRole("link", { name: copy.readWriteUp }).click();
    await expect(page).toHaveURL(/#write-up$/);
    await expect(
        main(page).getByRole("heading", {
            name: new RegExp(copy.writeUpThemed),
        }),
    ).toBeInViewport();
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

test.describe("on the fixture build", () => {
    test("a filled mission shows every module, its callouts linked", async ({
        page,
    }, testInfo) => {
        test.skip(testInfo.project.name !== "fixture", FIXTURE_ONLY);
        await page.goto("/portfolio/fixture-flagship-mission");
        for (const themed of [
            copy.calloutsThemed,
            copy.briefThemed,
            copy.writeUpThemed,
            copy.resultsThemed,
            copy.debriefThemed,
            copy.linksThemed,
            copy.relatedPlain,
        ]) {
            await expect(
                main(page).getByRole("heading", {
                    level: 2,
                    name: new RegExp(themed),
                }),
                themed,
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
        await expect(
            main(page).getByRole("link", { name: /^Original entry · LOG/ }),
        ).toHaveAttribute("href", "/blog/fixture-post-code-and-links");
    });

    test("a planned mission leaves out what it does not have", async ({
        page,
    }, testInfo) => {
        test.skip(testInfo.project.name !== "fixture", FIXTURE_ONLY);
        await page.goto("/portfolio/fixture-planned-mission");
        for (const themed of [
            copy.calloutsThemed,
            copy.briefThemed,
            copy.resultsThemed,
            copy.debriefThemed,
            copy.linksThemed,
            copy.relatedPlain,
        ]) {
            await expect(
                main(page).getByRole("heading", {
                    level: 2,
                    name: new RegExp(themed),
                }),
                themed,
            ).toHaveCount(0);
        }
        await expect(
            main(page)
                .getByRole("term")
                .filter({ hasText: /^Dates$/ }),
        ).toHaveCount(0);
        await expect(
            main(page).getByRole("link", { name: /^Original entry/ }),
        ).toHaveCount(0);
    });
});
