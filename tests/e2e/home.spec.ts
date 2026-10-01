import type { Page } from "@playwright/test";
import { chromeCopy, homeCopy as copy } from "@/lib/copy";
import { FIXTURE_PROFILE } from "@/lib/fixtures";
import sunrise from "@/lib/hero-sunrise.json";
import { expect, test } from "./support/test";
import { storeTheme } from "./support/theme";

/**
 * Home (plan §6.2 PR 13, contract §9; premium WS2): the hero's name,
 * headline, what the owner is open to and its one action (CV) with the
 * quiet link down to the projects are in the first viewport with and
 * without JavaScript; the header's wordmark steps aside while the hero
 * names the owner; the starfield drifts only while it may (on screen, in
 * a visible tab, in Void, with motion allowed) and reports `stopped`
 * otherwise; the stars are the hero's alone, and Void's; the photograph is
 * credited with its frame ID and Flight Manual draws the limb instead;
 * the name keeps one line at 1440 and spans 1,400px at most at 1920;
 * the sections follow in order, unnumbered, and lead to their pages; the
 * flagship shows no stats and at most four stack items; a row's cover is
 * a thumbnail, credited, that never outweighs the stage's photograph
 * (checked where the build has covers; the fixtures have none); the close is the
 * owner's tagline, the Timeline by that name and one way to /contact (the
 * profile's primary, else Send a message); the page stays short; and it
 * says nothing about what is missing.
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
    // One action (CV) and one quiet link down to the projects.
    const links = main.getByRole("navigation", { name: copy.routesLabel });
    await expect(links.getByRole("link")).toHaveText([
        copy.cv,
        copy.projectsAct.title,
    ]);
    expect(
        await links
            .getByRole("link")
            .evaluateAll((items) =>
                items.map((item) => item.getAttribute("href")),
            ),
    ).toEqual(["/resume", "#home-projects"]);
    await expect(links.getByRole("link", { name: copy.cv })).toBeInViewport({
        ratio: 1,
    });
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
        // The headline's and the Open To line's parts each keep one line,
        // so no line starts or ends on a dot.
        const wrapped = await hero(page)
            .locator(".open-to__item")
            .evaluateAll((items) =>
                items
                    .filter((item) => {
                        const box = item.getBoundingClientRect();
                        const line = parseFloat(
                            getComputedStyle(item).lineHeight,
                        );
                        return box.height > line * 1.5;
                    })
                    .map((item) => item.textContent),
            );
        expect(wrapped).toHaveLength(0);
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

test("the hero's name keeps one line at 1440 and 1,400px at most at 1920", async ({
    page,
}) => {
    await page.goto("/");
    const name = page.locator("#hero-name");
    // The display weight, tracked wide (premium D2).
    await expect(name).toHaveCSS("font-weight", "350");
    const tracking = await name.evaluate((heading) => {
        const style = getComputedStyle(heading);
        return parseFloat(style.letterSpacing) / parseFloat(style.fontSize);
    });
    expect(tracking).toBeGreaterThanOrEqual(0.11);
    expect(tracking).toBeLessThanOrEqual(0.12);
    const measure = () =>
        name.evaluate((heading) => {
            const range = document.createRange();
            range.selectNodeContents(heading);
            const lines = new Set(
                [...range.getClientRects()].map((rect) => Math.round(rect.top)),
            );
            return {
                width: range.getBoundingClientRect().width,
                lines: lines.size,
            };
        });
    await page.setViewportSize({ width: 1440, height: 900 });
    expect((await measure()).lines).toBe(1);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const wide = await measure();
    expect(wide.lines).toBe(1);
    expect(wide.width).toBeLessThanOrEqual(1400);
});

test("the header's wordmark steps aside while the hero names the owner", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const wordmark = page.getByRole("banner").locator(".brand__name");
    await expect(page.locator("html")).toHaveAttribute("data-hero", "");
    await expect(wordmark).toBeHidden();
    // Once the name has gone under the header, the wordmark is back,
    // while the rest of the hero is still on screen.
    await page.evaluate(() =>
        window.scrollTo({ top: 400, behavior: "instant" }),
    );
    await expect(page.locator("html")).not.toHaveAttribute("data-hero");
    await expect(wordmark).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(wordmark).toBeHidden();
    // The quiet link lands on the projects with the name in the header.
    await page
        .getByRole("main")
        .getByRole("link", { name: "Selected projects", exact: true })
        .click();
    await expect(page).toHaveURL(/#home-projects$/);
    await expect(page.locator("html")).not.toHaveAttribute("data-hero");
    await expect(wordmark).toBeVisible();
    await page
        .getByRole("main")
        .locator("#home-writing")
        .scrollIntoViewIfNeeded();
    await expect(page.locator("html")).not.toHaveAttribute("data-hero");
    await expect(wordmark).toBeVisible();
    // Another page keeps it.
    await page.getByRole("banner").getByRole("link", { name: "About" }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.locator("html")).not.toHaveAttribute("data-hero");
    await expect(wordmark).toBeVisible();
});

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
    await expect(credit).toContainText(sunrise.id);
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
    const order = ["home-projects", "home-writing", "home-contact"];
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
        ["home-contact", copy.contactAct.now, "/about#crew-now"],
        // The flight has one name everywhere.
        ["home-contact", copy.contactAct.timeline, "/resume/trajectory"],
    ];
    for (const [id, name, href] of leads) {
        const section = main.locator(`section#${id}`);
        if (!(await section.count())) continue;
        const link = section.getByRole("link", { name, exact: true });
        if (name === copy.contactAct.now && !(await link.count())) continue;
        await expect(link).toHaveAttribute("href", href);
    }
    // The latest writing lists no tags.
    await expect(
        main
            .locator("section#home-writing")
            .getByRole("list", { name: "Tags" }),
    ).toHaveCount(0);
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
        // The owner's tagline heads the close.
        await expect(close.getByRole("heading", { level: 2 })).toHaveText(
            FIXTURE_PROFILE.tagline!,
        );
    }
    // One way to /contact: the profile's answer, the one primary, while
    // there is an Open To line; else Send a message, never a primary.
    const message = close.getByRole("link", { name: copy.contactAct.message });
    await expect(message).toHaveCount(open ? 0 : 1);
    if (!open) await expect(message).toHaveAttribute("href", "/contact");
    await expect(close.locator('a[href^="/contact"]')).toHaveCount(1);
    await expect(close.locator(".btn--primary")).toHaveCount(open ? 1 : 0);
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
    // The title is the heading, in sentence case, over at most four stack
    // items.
    const stage = projects.getByRole("article").first();
    await expect(stage.getByRole("heading", { level: 3 })).toHaveCSS(
        "text-transform",
        "none",
    );
    expect(
        await stage.getByRole("list", { name: "Stack" }).locator("li").count(),
    ).toBeLessThanOrEqual(4);
});

for (const width of [390, 1440, 1920]) {
    test(`a row's cover is a credited thumbnail, smaller than the stage's plate, at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/");
        const projects = page
            .getByRole("main")
            .locator("section#home-projects");
        if (!(await projects.count())) return;
        // The fixtures carry no images; a build with covers is checked.
        const plates = await projects.evaluate((section) => {
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
                stage: size(section.querySelector("article figure")),
                rows: [...section.querySelectorAll("li figure")].map(
                    (figure) => {
                        const credit = figure.querySelector(
                            "figcaption .caption__src",
                        );
                        const style = credit ? getComputedStyle(credit) : null;
                        return {
                            ...size(figure),
                            caption:
                                figure.querySelector("figcaption")?.textContent,
                            credit: credit?.textContent ?? null,
                            font: style?.fontFamily ?? "",
                            size: style ? parseFloat(style.fontSize) : 0,
                        };
                    },
                ),
            };
        });
        // The owner's photograph stays the section's largest image: each
        // cover is narrower, and the rows' covers together are smaller.
        if (plates.stage.area) {
            const rows = plates.rows.reduce((sum, row) => sum + row.area, 0);
            expect(rows).toBeLessThan(plates.stage.area);
        }
        for (const row of plates.rows) {
            if (plates.stage.area) {
                expect(row.width).toBeLessThan(plates.stage.width);
            }
            // Its one line is a credit, in the hero credit's mono voice.
            if (row.caption) {
                expect(row.credit).toBe(row.caption);
                expect(row.font).toMatch(/Mono/);
                expect(row.size).toBeLessThanOrEqual(13);
            }
        }
    });
}

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
