import type { Page } from "@playwright/test";
import { chromeCopy, homeCopy as copy } from "@/lib/copy";
import { FIXTURE_PROFILE } from "@/lib/fixtures";
import sunrise from "@/lib/hero-sunrise.json";
import { expect, test } from "./support/test";
import { storeTheme } from "./support/theme";

/**
 * Home (plan §6.2 PR 13, contract §9): the hero's name, headline, what the
 * owner is open to and the quick links (Projects · CV · Contact) are in
 * the first viewport with and without JavaScript; the starfield drifts
 * only while it may (on screen, in a visible tab, in Void, with motion
 * allowed) and reports `stopped` otherwise; the stars are the hero's
 * alone, and Void's; the photograph is credited and Flight Manual draws
 * the limb instead; the sections follow in order,
 * unnumbered, and lead to their pages; the flagship shows no stats; the
 * page stays short; and it says nothing about what is missing.
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
    await expect(links.getByRole("link")).toHaveText([
        copy.projects,
        copy.cv,
        copy.contact,
    ]);
    expect(
        await links
            .getByRole("link")
            .evaluateAll((items) =>
                items.map((item) => item.getAttribute("href")),
            ),
    ).toEqual(["/portfolio", "/resume", "/contact"]);
    for (const link of await links.getByRole("link").all()) {
        await expect(link).toBeInViewport({ ratio: 1 });
    }
    // What the owner is open to, when the profile says.
    const open = hero(page).getByText(copy.openTo, { exact: true });
    if (await open.count()) await expect(open).toBeInViewport({ ratio: 1 });
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
    await page
        .getByRole("main")
        .locator("#home-contact")
        .scrollIntoViewIfNeeded();
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

    // Pause motion, beside it in the hero; the footer leaves it to the
    // hero on home.
    await expect(
        page.getByRole("contentinfo").getByRole("button", { name: /motion/ }),
    ).toBeHidden();
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
    // Paper has no stars, printed or drifting.
    await expect(page.locator(".static-stars")).toBeHidden();
});

test("the stars stay in the home hero", async ({ page }) => {
    for (const path of [
        "/portfolio",
        "/blog",
        "/resume",
        "/about",
        "/contact",
    ]) {
        await page.goto(path);
        await expect(page.locator(".static-stars"), path).toHaveCount(0);
    }
});

test("the sections follow the hero in order and lead to their pages", async ({
    page,
}) => {
    await page.goto("/");
    const main = page.getByRole("main");
    const ids = await main
        .locator("section[id^='home-']")
        .evaluateAll((sections) => sections.map((section) => section.id));
    const order = [
        "home-projects",
        "home-writing",
        "home-interests",
        "home-contact",
    ];
    expect(ids).toEqual(order.filter((id) => ids.includes(id)));
    expect(ids.at(-1)).toBe("home-contact");
    // No section numbers, and no themed section names to decode.
    await expect(main.getByText(/^§\s?\d/)).toHaveCount(0);
    for (const themed of ["Missions", "Flight Log", "Trajectory", "Comms"]) {
        await expect(main.getByText(themed, { exact: true })).toHaveCount(0);
    }

    const leads: [section: string, name: string, href: string][] = [
        ["home-projects", copy.projectsAct.all, "/portfolio"],
        ["home-writing", copy.writingAct.all, "/blog"],
        ["home-interests", copy.interestsAct.now, "/about#crew-now"],
        ["home-contact", copy.contactAct.message, "/contact"],
    ];
    for (const [id, name, href] of leads) {
        const section = main.locator(`section#${id}`);
        if (!(await section.count())) continue;
        const link = section.getByRole("link", { name, exact: true });
        if (id === "home-interests" && !(await link.count())) continue;
        await expect(link).toHaveAttribute("href", href);
    }
});

test("the close answers what the owner is open to only in the profile's words", async ({
    page,
}, testInfo) => {
    await page.goto("/");
    const close = page.getByRole("main").locator("section#home-contact");
    const answer = close.locator('a[href="/contact#hiring"]');
    const open = await hero(page)
        .getByText(copy.openTo, { exact: true })
        .count();
    // No Open To line, nothing to answer; and never a built-in "role".
    if (!open) await expect(answer).toHaveCount(0);
    if (testInfo.project.name === "fixture") {
        await expect(answer).toHaveText(FIXTURE_PROFILE.availability!.cta!);
    }
    await expect(
        close.getByRole("link", { name: copy.contactAct.message }),
    ).toHaveAttribute("href", "/contact");
});

test("the strongest project leads with its summary and no stats", async ({
    page,
}) => {
    await page.goto("/");
    const projects = page.getByRole("main").locator("section#home-projects");
    if (!(await projects.count())) return;
    await expect(projects.getByRole("article").first()).toBeVisible();
    // Stats are the project file's; the home page shows none, and no
    // mission number.
    await expect(projects.getByRole("definition")).toHaveCount(0);
    await expect(projects.getByText(/^MSN-\d+$/)).toHaveCount(0);
});

for (const [width, limit] of [
    [1440, 4500],
    [390, 7000],
]) {
    test(`the home page stays short at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/");
        const height = await page.evaluate(
            () => document.documentElement.scrollHeight,
        );
        expect(height).toBeLessThanOrEqual(limit);
    });
}

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
