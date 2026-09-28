import type { Page } from "@playwright/test";
import { chromeCopy, homeCopy as copy } from "@/lib/copy";
import sunrise from "@/lib/hero-sunrise.json";
import { expect, test } from "./support/test";
import { storeTheme } from "./support/theme";

/**
 * Home (plan §6.2 PR 13, contract §9): the hero's name, role, status line
 * and quick links (CV first) are in the first viewport with and without
 * JavaScript; the starfield drifts only while it may (on screen, in a
 * visible tab, in Void, with motion allowed) and reports `stopped`
 * otherwise; the photograph is credited and Flight Manual draws the limb
 * instead; the acts are numbered in order and link to their sections; and
 * the page says nothing about what is missing.
 */

function hero(page: Page) {
    return page
        .getByRole("main")
        .getByRole("region", { name: /Rajendran|Adithya/ });
}

function starfield(page: Page) {
    return page.locator("[data-starfield]");
}

async function firstViewport(page: Page) {
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1 })).toBeInViewport({
        ratio: 1,
    });
    const links = main.getByRole("navigation", { name: copy.routesLabel });
    const first = links.getByRole("link").first();
    await expect(first).toHaveText(copy.cv);
    await expect(first).toHaveAttribute("href", "/resume");
    for (const link of await links.getByRole("link").all()) {
        await expect(link).toBeInViewport({ ratio: 1 });
    }
    // The status line: the current role, when the profile has one.
    const now = hero(page).getByText(copy.now, { exact: true });
    if (await now.count()) await expect(now).toBeInViewport({ ratio: 1 });
}

for (const [width, height] of [
    [1280, 800],
    [390, 844],
]) {
    test(`the hero is in the first viewport at ${width}×${height}`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height });
        await page.goto("/");
        await firstViewport(page);
    });

    test.describe(`without JavaScript at ${width}×${height}`, () => {
        test.use({ javaScriptEnabled: false });
        test("the hero is in the first viewport", async ({ page }) => {
            await page.setViewportSize({ width, height });
            await page.goto("/");
            await firstViewport(page);
            // No canvas without JavaScript: the static stars stand in.
            await expect(starfield(page)).not.toHaveAttribute(
                "data-state",
                /.*/,
            );
            await expect(page.locator(".static-stars").first()).toBeVisible();
        });
    });
}

test("the starfield drifts only while it may", async ({ page }) => {
    await page.goto("/");
    const stars = starfield(page);
    await expect(stars).toHaveAttribute("data-state", "running");

    // Offscreen.
    await page.getByRole("main").locator("#comms").scrollIntoViewIfNeeded();
    await expect(stars).toHaveAttribute("data-state", "stopped");
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(stars).toHaveAttribute("data-state", "running");

    // A hidden tab.
    await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            get: () => "hidden",
        });
        document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(stars).toHaveAttribute("data-state", "stopped");
    await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            get: () => "visible",
        });
        document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(stars).toHaveAttribute("data-state", "running");

    // Pause motion, beside it in the hero.
    await hero(page)
        .getByRole("button", { name: chromeCopy.holdDrift })
        .click();
    await expect(page.locator("html")).toHaveAttribute(
        "data-motion",
        "reduced",
    );
    await expect(stars).toHaveAttribute("data-state", "stopped");
    await hero(page)
        .getByRole("button", { name: chromeCopy.resumeDrift })
        .click();
    await expect(stars).toHaveAttribute("data-state", "running");
});

test("the starfield holds still under the OS reduce-motion setting", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(starfield(page)).toHaveAttribute("data-state", "stopped");
    // A still frame is drawn, so the static layer steps aside.
    await expect(starfield(page)).toHaveAttribute("data-drawn", "");
    await expect(hero(page).getByText(chromeCopy.motionHeldByOs)).toBeVisible();
});

test("the photograph is credited in Void; Manual draws the limb", async ({
    page,
}) => {
    await page.goto("/");
    const credit = hero(page).getByRole("link", { name: sunrise.credit });
    await expect(credit).toBeVisible();
    await expect(credit).toHaveAttribute("href", sunrise.source);
    const photo = hero(page).locator("picture img");
    await expect(photo).toHaveAttribute("alt", "");
    await expect(photo).toBeVisible();

    await storeTheme(page, "manual");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "manual");
    await expect(photo).toBeHidden();
    await expect(credit).toBeHidden();
    await expect(starfield(page)).toHaveAttribute("data-state", "stopped");
    await expect(starfield(page)).toBeHidden();
});

test("the acts are numbered in order and lead to their sections", async ({
    page,
}) => {
    await page.goto("/");
    const main = page.getByRole("main");
    const acts = main.locator("section[id]").filter({
        has: page.locator(".section-tag"),
    });
    const numbers = await acts.locator(".section-tag__num").allTextContents();
    expect(numbers.length).toBeGreaterThan(0);
    expect(numbers).toEqual(numbers.map((_, i) => `§00.${i + 1}`));

    const leads: [act: string, name: string, href: string][] = [
        ["missions", copy.missionsAct.all, "/portfolio"],
        ["log", copy.logAct.all, "/blog"],
        ["trajectory", copy.trajectoryAct.all, "/resume"],
        ["crew", copy.crewAct.all, "/about"],
        ["comms", copy.commsAct.all, "/contact"],
    ];
    for (const [act, name, href] of leads) {
        const section = main.locator(`section#${act}`);
        if (!(await section.count())) continue;
        await expect(
            section.getByRole("link", { name, exact: true }),
        ).toHaveAttribute("href", href);
    }

    // Selected work ↓ lands on the Missions act.
    await main.getByRole("link", { name: copy.work }).click();
    await expect(main.locator("#missions")).toBeInViewport();
});

test("an orbit's label leads to its row, and the row lights the orbit", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const trajectory = page.getByRole("main").locator("#trajectory");
    const label = trajectory.locator("a[data-orbit-to]:visible").first();
    const target = (await label.getAttribute("data-orbit-to"))!;
    await label.click();
    const row = trajectory.locator(`#${target}`);
    await expect(row).toBeInViewport();
    await expect(page).toHaveURL(new RegExp(`#${target}$`));

    const id = (await row.getAttribute("data-orbit-row"))!;
    await page.mouse.move(0, 0);
    await row.hover();
    await expect(
        trajectory.locator(`path[data-orbit-id="${id}"]:visible`).first(),
    ).toHaveAttribute("data-hl", "");
});

test("the home page names no gap and uses no old artwork", async ({ page }) => {
    const requested: string[] = [];
    page.on("request", (request) => requested.push(request.url()));
    await page.goto("/");
    const text = (await page.getByRole("main").innerText()).toLowerCase();
    for (const phrase of [
        "tbd",
        "not published",
        "intentionally",
        "placeholder",
        "stand-in",
        "instead of guessing",
        "left blank",
    ]) {
        expect(text, phrase).not.toContain(phrase);
    }
    expect(requested.some((url) => /lunar/.test(url))).toBe(false);
    expect(await page.content()).not.toMatch(/mailto:|tel:/);
});
