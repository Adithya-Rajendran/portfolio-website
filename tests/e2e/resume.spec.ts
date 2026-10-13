import type { Page } from "@playwright/test";
import { siteConfig } from "@/lib/config";
import { chromeCopy, cvCopy, homeCopy, trajectoryCopy } from "@/lib/copy";
import { axeViolations } from "./support/axe";
import { expect, test } from "./support/test";
import { THEMES, storeTheme } from "./support/theme";

/**
 * Experience & CV (G3, premium D3; the flight as the default view): /resume
 * is the record in two views under one head with what the owner is open
 * to, the PDF and Contact. Timeline, the flight, is the default where
 * motion runs; List, the CV, under reduced motion, without JavaScript and
 * when the address names a part of it. A click switches views for the
 * visit, in place; Skip to the list, The full record and a card's Full
 * entry land on the list. A project row's link to one of the site's posts
 * opens in place, and every credential is the same plain row. The list
 * says each thing once: no upload date in the head, no status, kind code,
 * type line or Skills or Links key on a row, no employment the title says, no
 * issuer the credential's name says, and no second rule under a section
 * head. Rows are found by their content, so the spec fits fixture and
 * real content alike. The flight itself is trajectory.spec's.
 */

function main(page: Page) {
    return page.getByRole("main");
}

function views(page: Page) {
    return main(page).getByRole("group", { name: cvCopy.views.legend });
}

function option(page: Page, name: "Timeline" | "List") {
    return views(page).getByRole("radio", { name, exact: true });
}

/** The list's first section head. */
function firstSection(page: Page) {
    return page.locator("#cv h2").first();
}

/** The CV's Experience section, the list's sign. */
function experience(page: Page) {
    return main(page).getByRole("heading", {
        level: 2,
        name: cvCopy.experience,
        exact: true,
    });
}

test("the head offers the CV and the views in the first viewport, and leaves Contact to the header", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/resume");
    // The header's Contact is in the same viewport: the head repeats it
    // nowhere, and Download CV (when there is a PDF) is its one action.
    const head = main(page).locator(".page-head");
    await expect(head.getByRole("link", { name: /contact/i })).toHaveCount(0);
    await expect(
        page
            .getByRole("banner")
            .getByRole("link", { name: "Contact", exact: true }),
    ).toBeInViewport();
    await expect(head.locator(".btn:not(.btn--primary)")).toHaveCount(0);
    // What the owner is open to, when set.
    const openTo = main(page).getByText(cvCopy.openTo, { exact: true });
    if (await openTo.count()) await expect(openTo.first()).toBeInViewport();
    // Timeline · List, by plain names, in the head's tools; the flight is
    // the view where motion runs, and its stage starts in the first
    // viewport.
    await expect(views(page)).toBeInViewport();
    const radios = views(page).getByRole("radio");
    await expect(radios).toHaveCount(2);
    await expect(radios.first()).toHaveAccessibleName("Timeline");
    await expect(radios.last()).toHaveAccessibleName("List");
    await expect(option(page, "Timeline")).toBeChecked();
    await expect(page.locator("[data-journey] [data-stage]")).toBeInViewport();
    await expect(experience(page)).toBeHidden();
    await expect(main(page)).not.toContainText(/\bOrbit \d{2}\b/);
    await expect(main(page)).not.toContainText(/show on timeline/i);
    // No Open PDF, Print or Share (the browser's Print still prints the
    // CV), and no link to a page of the flight's own.
    for (const name of [/open pdf/i, /print/i, /share/i]) {
        await expect(main(page).getByRole("link", { name })).toHaveCount(0);
    }
    await expect(
        main(page).locator('a[href^="/resume/trajectory"]'),
    ).toHaveCount(0);
});

test.describe("for a crawler that runs scripts", () => {
    test.use({
        userAgent:
            "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.122 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        viewport: { width: 412, height: 732 },
    });

    test("the list is the view and the flight is never built", async ({
        page,
    }) => {
        await page.goto("/resume");
        await expect(page.locator("[data-views]")).toHaveAttribute(
            "data-view",
            "list",
        );
        await expect(option(page, "List")).toBeChecked();
        await expect(experience(page)).toBeVisible();
        await expect(page.locator("[data-journey]")).toBeHidden();
        await expect(page.locator("[data-scene] > canvas")).toHaveCount(0);
    });
});

test("the views switch in place and hold for the visit", async ({ page }) => {
    await page.goto("/resume");
    await expect(option(page, "Timeline")).toBeChecked();
    await option(page, "List").check();
    await expect(experience(page)).toBeVisible();
    await expect(page.locator("[data-journey]")).toBeHidden();
    // The scene is not kept while the list shows.
    await expect(page.locator("[data-scene] > canvas")).toHaveCount(0);
    // Away and back in the same visit: still the list.
    await page
        .getByRole("banner")
        .getByRole("link", { name: "About", exact: true })
        .click();
    await expect(page).toHaveURL(/\/about$/);
    await page
        .getByRole("banner")
        .getByRole("link", { name: "Experience", exact: true })
        .click();
    await expect(page).toHaveURL(/\/resume$/);
    await expect(option(page, "List")).toBeChecked();
    await expect(experience(page)).toBeVisible();
    // And back to the flight.
    await option(page, "Timeline").check();
    await expect(page.locator("[data-journey] [data-scene]")).toHaveAttribute(
        "data-ready",
        "",
        { timeout: 20_000 },
    );
    await expect(experience(page)).toBeHidden();
});

test("Skip to the list, The full record and a card's Full entry land on the list", async ({
    page,
}) => {
    await page.goto("/resume");
    await expect(option(page, "Timeline")).toBeChecked();
    // Skip to the list: for a keyboard, after the switch; shown on focus.
    const skip = main(page).getByRole("link", { name: trajectoryCopy.skip });
    await option(page, "Timeline").focus();
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
    expect((await skip.boundingBox())!.width).toBeGreaterThan(40);
    await page.keyboard.press("Enter");
    await expect(option(page, "List")).toBeChecked();
    await expect(firstSection(page)).toBeInViewport();
    await expect(page.locator("#cv")).toBeFocused();
    // The address names the list, so a reload returns to it.
    await expect(page).toHaveURL(/\/resume#cv$/);

    // The full record, after the flight.
    await option(page, "Timeline").check();
    const record = main(page).getByRole("link", {
        name: trajectoryCopy.close,
    });
    await record.scrollIntoViewIfNeeded();
    await record.click();
    await expect(option(page, "List")).toBeChecked();
    await expect(firstSection(page)).toBeInViewport();
    await expect(page).toHaveURL(/\/resume#cv$/);

    // A card's Full entry: the chapter's row.
    await option(page, "Timeline").check();
    await page.evaluate(() => window.scrollTo(0, 0));
    const card = page.locator('[data-journey] [data-card="0"]');
    const href = await card
        .getByRole("link", { name: trajectoryCopy.entry })
        .getAttribute("href");
    await card.getByRole("link", { name: trajectoryCopy.entry }).click();
    await expect(option(page, "List")).toBeChecked();
    const id = href!.split("#")[1];
    const row = page.locator(`[id="${id}"]`);
    await expect(row).toBeInViewport();
    await expect(row).toBeFocused();
    // The address names the row: a reload opens the list there.
    await expect(page).toHaveURL(new RegExp(`/resume#${id}$`));
    await page.reload();
    await expect(option(page, "List")).toBeChecked();
    await expect(row).toBeInViewport();
});

test("under reduced motion the list is the view; Timeline is the flight's still", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/resume");
    await expect(option(page, "List")).toBeChecked();
    await expect(experience(page)).toBeVisible();
    await expect(page.locator("[data-journey]")).toBeHidden();
    // Nothing of the scene is fetched for a view not shown.
    await expect(page.locator("[data-scene] > canvas")).toHaveCount(0);
    await option(page, "Timeline").check();
    const stage = page.locator("[data-journey] [data-stage]");
    await expect(stage).toBeVisible();
    // Still: the section is the stage, nothing pins, and there is no Play.
    const [section, held] = await Promise.all([
        page
            .locator("[data-journey]")
            .evaluate((el) => (el as HTMLElement).offsetHeight),
        stage.evaluate((el) => (el as HTMLElement).offsetHeight),
    ]);
    expect(section).toBe(held);
    await expect(
        main(page).getByRole("button", { name: trajectoryCopy.play }),
    ).toBeHidden();
    // A still card's "– present" says it is current: no "● Current".
    await expect(
        page.locator("[data-journey] [data-card][data-on] .status"),
    ).toBeHidden();
});

test("an address that names a part of the CV opens the list there", async ({
    page,
}) => {
    // A section, and the list itself (the views' own id).
    for (const [hash, part] of [
        ["#experience", experience(page)],
        ["#cv", firstSection(page)],
    ] as const) {
        // A fresh document each time, not a same-page fragment change.
        await page.goto("about:blank");
        await page.goto(`/resume${hash}`);
        await expect(part).toBeInViewport();
        await expect(option(page, "List")).toBeChecked();
        await expect(page.locator("[data-journey]")).toBeHidden();
    }
});

test("the CV's address keeps the head's last row in view, at 1440 and on a phone", async ({
    page,
}) => {
    // iPhone 13's viewport: 390×664.
    for (const viewport of [
        { width: 1440, height: 900 },
        { width: 390, height: 664 },
    ]) {
        await page.setViewportSize(viewport);
        await page.goto("about:blank");
        await page.goto("/resume#cv");
        await expect(option(page, "List")).toBeChecked();
        await expect(firstSection(page)).toBeInViewport();
        // Download CV (PDF), the head's one action, where the build has a
        // PDF (the fixtures have none); else the head's last row, the
        // Open To line: wholly under the sticky header.
        const head = main(page).locator(".page-head");
        const download = head.getByRole("link", { name: cvCopy.download });
        const last = (await download.count())
            ? download
            : head.locator(":scope > :last-child");
        const header = (await page.getByRole("banner").boundingBox())!;
        await expect
            .poll(async () => (await last.boundingBox())!.y, {
                message: `${viewport.width}px: the head's last row's top`,
            })
            .toBeGreaterThanOrEqual(header.y + header.height);
        const box = (await last.boundingBox())!;
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }
});

test("CV opens the list, whichever view the visit picked", async ({ page }) => {
    const cv = () =>
        main(page).getByRole("link", { name: homeCopy.cv, exact: true });
    await page.goto("/");
    await cv().click();
    await expect(page).toHaveURL(/\/resume#cv$/);
    await expect(option(page, "List")).toBeChecked();
    await expect(firstSection(page)).toBeInViewport();
    // Timeline picked for the visit, then home's CV again (a client
    // navigation back to the page).
    await option(page, "Timeline").check();
    await expect(page.locator("[data-journey]")).toBeVisible();
    await page
        .getByRole("banner")
        .getByRole("link", { name: chromeCopy.homeLabel })
        .click();
    await expect(page).toHaveURL(/\/$/);
    await cv().click();
    await expect(option(page, "List")).toBeChecked();
    await expect(page.locator("[data-journey]")).toBeHidden();
    // On a phone, the header's CV from the flight on the page itself.
    await page.setViewportSize({ width: 390, height: 844 });
    await option(page, "Timeline").check();
    await expect(page.locator("[data-journey]")).toBeVisible();
    await page
        .getByRole("banner")
        .getByRole("link", { name: "CV", exact: true })
        .click();
    await expect(option(page, "List")).toBeChecked();
    await expect(firstSection(page)).toBeInViewport();
});

test("the CV links the site in place and lists every credential alike", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/resume");
    await expect(experience(page)).toBeVisible();
    // A link to the site itself is never an external link: a post opens
    // in place, and the site's own address is left out.
    const site = new URL(siteConfig.url).hostname.replace(/^www\./, "");
    const outbound = main(page).locator("#projects a[target='_blank']");
    for (const href of await outbound.evaluateAll((links) =>
        links.map((link) => (link as HTMLAnchorElement).href),
    )) {
        expect(new URL(href).hostname.replace(/^www\./, ""), href).not.toBe(
            site,
        );
    }
    // Every credential is the same plain row: no status label, and no
    // credential set as a heading of its own (only Prior certifications).
    const certifications = main(page).locator("#certifications");
    if (await certifications.count()) {
        await expect(certifications).not.toContainText(/no expiry|expired/i);
        await expect(
            certifications
                .getByRole("heading", { level: 3 })
                .filter({ hasNotText: cvCopy.priorCertifications }),
        ).toHaveCount(0);
    }
});

test("the list says each thing once", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/resume");
    await expect(experience(page)).toBeVisible();
    // The head: no upload date reading as the page's own; its tag row's
    // hairline runs to the edge.
    const head = main(page).locator(".page-head");
    await expect(head.locator(".section-tag__meta")).toHaveCount(0);
    await expect(head).not.toContainText(/\bUpdated\b/);
    // No status, kind code or Skills or Links key on a row: "– present",
    // the section's name, the mono names and the link's own words say
    // them.
    const list = main(page).locator("#cv");
    await expect(list.locator(".status")).toHaveCount(0);
    await expect(
        list.locator(".cv-item").getByText(/^(Talk|Paper|Skills|Links)$/),
    ).toHaveCount(0);
    // A project row has no type line.
    await expect(
        list.locator("#projects").getByText(/^(Software|Infrastructure)/),
    ).toHaveCount(0);
    // No employment the title already says ("Internship" by "… Intern").
    for (const row of await list.locator(".cv-item").all()) {
        const title =
            (await row.locator(".cv-item__title").textContent()) ?? "";
        if (/\bintern\b/i.test(title)) {
            await expect(row.locator(".cv-item__aside")).not.toContainText(
                /Internship/,
            );
        }
    }
    // No issuer the credential's name already says.
    for (const row of await main(page).locator("#certifications li").all()) {
        const text = (await row.innerText()).replace(/\s+/g, " ");
        const [line, issuer] = text.split(" · ").slice(-2);
        if (issuer)
            expect(line.toLowerCase(), text).not.toContain(
                issuer.toLowerCase(),
            );
    }
    // One rule under a section head: its first row draws no second.
    for (const section of await list.locator("section").all()) {
        const first = section.locator(".g-main > :first-child > :first-child");
        if (!(await first.count())) continue;
        await expect(first).toHaveCSS("border-top-width", "0px");
    }
});

// a11y.spec checks the page as it opens (the flight); the list is checked
// here.
for (const theme of THEMES) {
    for (const width of [390, 1440]) {
        test(`axe finds nothing in the list in ${theme} at ${width}px`, async ({
            page,
        }) => {
            await page.setViewportSize({
                width,
                height: width < 600 ? 844 : 900,
            });
            await storeTheme(page, theme);
            await page.emulateMedia({ reducedMotion: "reduce" });
            await page.goto("/resume");
            await page.waitForLoadState("networkidle");
            await expect(experience(page)).toBeVisible();
            expect(await axeViolations(page, "/resume")).toEqual([]);
        });
    }
}

test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("the CV shows, with no switch and no flight", async ({ page }) => {
        await page.goto("/resume");
        await expect(experience(page)).toBeVisible();
        await expect(main(page).getByRole("radio")).toHaveCount(0);
        await expect(main(page).getByRole("button")).toHaveCount(0);
        // The flight's chapters never repeat the CV.
        await expect(page.locator("[data-journey]")).toBeHidden();
    });
});
