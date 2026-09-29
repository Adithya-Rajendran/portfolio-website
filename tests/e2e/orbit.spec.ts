import type { Locator, Page } from "@playwright/test";
import { cvCopy, orbitCopy } from "@/lib/copy";
import { expect, test } from "./support/test";

/**
 * The Trajectory orbit map (G2, plan §6.2 PR 11), the optional Timeline
 * view of /resume: the page opens on the CV list with the map hidden and
 * no per-row map buttons; the view switch (List | Timeline) and a link to
 * `#orbit-map` open it. In the Timeline view "Show on timeline" pins a
 * row's orbit, a CV row lights its orbit and an orbit lights its row; a click
 * pins an orbit's record in the panel, a second click, empty sky or
 * Escape releases it, and Earlier and Later step through the records.
 * Without JavaScript the list shows, the map opens from its link, and
 * each label links to its CV row. Rows are found by their content, so
 * the spec fits fixture and real content alike.
 */

const DESIGNATION = /^Orbit \d{2}/;

function main(page: Page) {
    return page.getByRole("main");
}

/** The CV rows that stand for an orbit: in the Timeline view they offer
 *  "Show on timeline". */
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

/** The map's section head. */
function mapHeading(page: Page): Locator {
    return main(page).getByRole("heading", { name: cvCopy.map, exact: true });
}

/** Open the Map view with the view switch. */
async function openMap(page: Page) {
    await page
        .getByRole("radio", { name: cvCopy.views[1].label })
        .check({ force: true });
    await expect(mapHeading(page)).toBeVisible();
}

async function rowTitle(row: Locator): Promise<string> {
    return (
        (await row.getByRole("heading", { level: 3 }).textContent()) ?? ""
    ).trim();
}

test.describe("with a pointer at 1440px", () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test("the page opens on the CV list, with the map one click away", async ({
        page,
    }) => {
        await page.goto("/resume");
        await expect(
            page.getByRole("radio", { name: cvCopy.views[0].label }),
        ).toBeChecked();
        await expect(mapHeading(page)).toBeHidden();
        await expect(
            main(page).getByRole("heading", {
                name: cvCopy.education,
                exact: true,
            }),
        ).toBeVisible();
        await openMap(page);
    });

    test("a CV row lights its orbit, and an orbit lights its row", async ({
        page,
    }) => {
        await page.goto("/resume");
        await openMap(page);
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
        await openMap(page);
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
        await openMap(page);
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

    test("Show on timeline pins the row's orbit and brings it into view", async ({
        page,
    }) => {
        await page.goto("/resume");
        await expect(mapHeading(page)).toBeHidden();
        // The list carries no per-row map buttons.
        await expect(
            main(page).getByRole("button", { name: cvCopy.showOnMap }),
        ).toHaveCount(0);
        await openMap(page);
        const row = orbitRows(page).last();
        const title = await rowTitle(row);
        await row.getByRole("button", { name: cvCopy.showOnMap }).click();
        const orbit = orbitButton(page, title);
        await expect(orbit).toHaveAttribute("aria-pressed", "true");
        await expect(orbit).toBeInViewport();
        await expect(orbit).toBeFocused();
    });

    test("the List view hides the map again, and #orbit-map opens it", async ({
        page,
    }) => {
        await page.goto("/resume");
        await openMap(page);
        await page
            .getByRole("radio", { name: cvCopy.views[0].label })
            .check({ force: true });
        await expect(mapHeading(page)).toBeHidden();
        await expect(
            main(page).getByRole("heading", {
                level: 2,
                name: cvCopy.experience,
                exact: true,
            }),
        ).toBeVisible();
        await expect(orbitRows(page)).toHaveCount(0);

        await page.goto("/resume#orbit-map");
        await expect(mapHeading(page)).toBeVisible();
        await expect(
            page.getByRole("radio", { name: cvCopy.views[1].label }),
        ).toBeChecked();
    });
});

test("the head offers the CV and the way to get in touch, in the first viewport", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/resume");
    const contact = main(page).getByRole("link", {
        name: cvCopy.contact,
        exact: true,
    });
    await expect(contact).toBeInViewport();
    await expect(contact).toHaveAttribute("href", /^\/contact(#hiring)?$/);
    // What the owner is open to, when set, sits above it.
    const openTo = main(page).getByText(cvCopy.openTo, { exact: true });
    if (await openTo.count()) await expect(openTo.first()).toBeInViewport();
});

test("on a phone the map runs upwards, with every orbit labelled", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/resume");
    await openMap(page);
    const rows = orbitRows(page);
    for (const row of await rows.all()) {
        await expect(orbitButton(page, await rowTitle(row))).toBeVisible();
    }
});

test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("the list shows, the map opens from its link, and each label links to its row", async ({
        page,
    }) => {
        await page.goto("/resume");
        await expect(
            main(page).getByRole("heading", {
                level: 2,
                name: cvCopy.experience,
                exact: true,
            }),
        ).toBeVisible();
        await expect(mapHeading(page)).toBeHidden();
        await main(page).getByRole("link", { name: cvCopy.showMap }).click();
        await expect(page).toHaveURL(/#orbit-map$/);
        await expect(mapHeading(page)).toBeVisible();
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
