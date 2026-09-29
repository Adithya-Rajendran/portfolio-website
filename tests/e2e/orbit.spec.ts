import type { Locator, Page } from "@playwright/test";
import { cvCopy, orbitCopy } from "@/lib/copy";
import { expect, test } from "./support/test";

/**
 * The Trajectory orbit map (G2, plan §6.2 PR 11): a CV row lights its
 * orbit and an orbit lights its row; a click pins an orbit's record in
 * the panel, a second click, empty sky or Escape releases it, and Earlier
 * and Later step through the records; "Show on map" pins from the list;
 * the view switch hides and restores the map. Without JavaScript the map
 * and the list are both there, and each label links to its CV row.
 * Rows are found by their content, so the spec fits fixture and real
 * content alike.
 */

const DESIGNATION = /^Orbit \d{2}/;

function main(page: Page) {
    return page.getByRole("main");
}

/** The CV rows that stand for an orbit: they offer "Show on map". */
function orbitRows(page: Page): Locator {
    return main(page)
        .getByRole("listitem")
        .filter({
            has: page.getByRole("button", { name: cvCopy.showOnMap }),
        });
}

/** An orbit's label on the visible projection, by its entry's title. */
function orbitButton(page: Page, title: string): Locator {
    return main(page)
        .getByRole("button", { name: DESIGNATION })
        .filter({ hasText: title });
}

/** The record the panel shows: its one visible heading. */
function panelTitle(page: Page): Locator {
    return main(page)
        .locator("[data-orbit-panel]")
        .getByRole("heading", { level: 3 });
}

async function rowTitle(row: Locator): Promise<string> {
    return (
        (await row.getByRole("heading", { level: 3 }).textContent()) ?? ""
    ).trim();
}

test.describe("with a pointer at 1440px", () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test("a CV row lights its orbit, and an orbit lights its row", async ({
        page,
    }) => {
        await page.goto("/resume");
        const rows = orbitRows(page);
        expect(await rows.count()).toBeGreaterThan(1);
        const row = rows.nth(1);
        const title = await rowTitle(row);
        const orbit = orbitButton(page, title);
        await expect(orbit).toBeVisible();

        await row.hover();
        await expect(orbit).toHaveAttribute("data-hl", "");
        await expect(row).toHaveAttribute("data-hl", "");

        await page.mouse.move(0, 0);
        await expect(orbit).not.toHaveAttribute("data-hl", "");

        await orbit.hover();
        await expect(row).toHaveAttribute("data-hl", "");
        // Hovering previews the orbit's record in the panel.
        await expect(panelTitle(page)).toHaveText(title);
    });

    test("a click pins an orbit's record; a second click or Escape releases it", async ({
        page,
    }) => {
        await page.goto("/resume");
        const current = (await panelTitle(page).textContent())?.trim() ?? "";
        const title = await rowTitle(orbitRows(page).last());
        expect(title).not.toBe(current);
        const orbit = orbitButton(page, title);

        await orbit.click();
        await expect(orbit).toHaveAttribute("aria-pressed", "true");
        await page.mouse.move(0, 0);
        await expect(panelTitle(page)).toHaveText(title);

        await orbit.click();
        await expect(orbit).toHaveAttribute("aria-pressed", "false");
        await page.mouse.move(0, 0);
        await expect(panelTitle(page)).toHaveText(current);

        await orbit.click();
        await page.keyboard.press("Escape");
        await expect(orbit).toHaveAttribute("aria-pressed", "false");
    });

    test("Earlier and Later step through the records", async ({ page }) => {
        await page.goto("/resume");
        const first = (await panelTitle(page).textContent())?.trim() ?? "";
        const panel = main(page).locator("[data-orbit-panel]");
        await panel.getByRole("button", { name: orbitCopy.earlier }).click();
        await page.mouse.move(0, 0);
        const earlier = (await panelTitle(page).textContent())?.trim() ?? "";
        expect(earlier).not.toBe(first);
        await panel.getByRole("button", { name: orbitCopy.later }).click();
        await page.mouse.move(0, 0);
        await expect(panelTitle(page)).toHaveText(first);
    });

    test("Show on map pins the row's orbit and brings the map into view", async ({
        page,
    }) => {
        await page.goto("/resume");
        const row = orbitRows(page).last();
        const title = await rowTitle(row);
        await row.getByRole("button", { name: cvCopy.showOnMap }).click();
        const orbit = orbitButton(page, title);
        await expect(orbit).toHaveAttribute("aria-pressed", "true");
        await expect(orbit).toBeInViewport();
        await expect(orbit).toBeFocused();
    });

    test("the CV list view hides the map, and the map view restores it", async ({
        page,
    }) => {
        await page.goto("/resume");
        const map = main(page).getByRole("heading", {
            name: cvCopy.map,
            exact: true,
        });
        await expect(map).toBeVisible();
        await page
            .getByRole("radio", { name: cvCopy.views[1].label })
            .check({ force: true });
        await expect(map).toBeHidden();
        await expect(orbitRows(page).first()).toBeVisible();
        await page
            .getByRole("radio", { name: cvCopy.views[0].label })
            .check({ force: true });
        await expect(map).toBeVisible();
    });
});

test("on a phone the map runs upwards, with every orbit labelled", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/resume");
    const rows = orbitRows(page);
    for (const row of await rows.all()) {
        await expect(orbitButton(page, await rowTitle(row))).toBeVisible();
    }
});

test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("the map and the list are both there, and each label links to its row", async ({
        page,
    }) => {
        await page.goto("/resume");
        await expect(
            main(page).getByRole("heading", {
                name: cvCopy.map,
                exact: true,
            }),
        ).toBeVisible();
        const labels = main(page).getByRole("link", { name: DESIGNATION });
        expect(await labels.count()).toBeGreaterThan(0);
        for (const label of await labels.all()) {
            const href = (await label.getAttribute("href")) ?? "";
            expect(href).toMatch(/^#cv-/);
            await expect(main(page).locator(href)).toBeVisible();
        }
        await expect(main(page).getByRole("button")).toHaveCount(0);
    });
});
