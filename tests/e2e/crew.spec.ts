import { aboutCopy as copy, crewCopy, nowKinds } from "@/lib/copy";
import { expect, test } from "./support/test";
import { STATIC_PAGES } from "./support/routes";

/**
 * About (themed Crew File; plan §6.2 PR 14, contract §9): the head with
 * the patch as the identity mark and no portrait, the profile record, the
 * sections by their plain names (background, the Now list by kind,
 * writing, related pages) and the way to get in touch; the page names no
 * gap. And the old design is gone from every page: no legacy root, class
 * or token.
 */

test("About opens on its head, the patch and the record", async ({ page }) => {
    await page.goto("/about");
    const main = page.getByRole("main");
    const h1 = main.getByRole("heading", { level: 1 });
    // The plain name is the title; the themed one is the small tag.
    await expect(h1).toHaveText(copy.plain);
    await expect(
        main.getByText(copy.themed, { exact: true }).first(),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-header", "solid");

    // The patch is the identity mark: decorative, and no portrait.
    const patch = main.locator(".page-head__figure");
    await expect(patch).toHaveAttribute("aria-hidden", "true");
    await expect(patch.locator("use")).toHaveAttribute("href", "#ar-patch");
    await expect(patch).toBeVisible();
    await expect(main.locator("img")).toHaveCount(0);

    const record = main.getByRole("group", { name: crewCopy.recordLabel });
    await expect(record).toBeVisible();
    await expect(
        record.getByText(crewCopy.name, { exact: true }),
    ).toBeVisible();

    await expect(
        main.getByRole("link", { name: copy.experience }),
    ).toHaveAttribute("href", "/resume");
});

test("the sections name themselves plainly and lead on", async ({ page }) => {
    await page.goto("/about");
    const main = page.getByRole("main");
    // No section numbers: a heading's words are its name.
    await expect(main.getByText(/^§\s?\d/)).toHaveCount(0);

    const bio = main.getByRole("region", { name: copy.bio, exact: true });
    await expect(bio.locator("p").first()).toBeVisible();

    const now = main.getByRole("region", { name: copy.now, exact: true });
    if (await now.count()) {
        await expect(now.getByRole("heading", { level: 3 }).first()).toHaveText(
            new RegExp(`^(${Object.values(nowKinds).join("|")})$`, "i"),
        );
        await expect(now.getByRole("listitem").first()).toBeVisible();
    }

    const writing = main.getByRole("region", { name: /^(Writing|Talks)/ });
    if (await writing.count()) {
        const all = writing.getByRole("link", { name: copy.allEntries });
        if (await all.count())
            await expect(all).toHaveAttribute("href", "/blog");
    }

    const related = main.getByRole("navigation", { name: copy.elsewhere });
    for (const link of await related.getByRole("link").all()) {
        await expect(link).toHaveAttribute(
            "href",
            /^\/(resume#(experience|skills|certifications)|portfolio)$/,
        );
    }

    const touch = main.getByRole("link", { name: copy.getInTouch });
    await expect(touch).toHaveAttribute("href", "/contact#hello");
    await touch.click();
    await expect(page).toHaveURL(/\/contact#hello$/);
});

test("About names no gap and shows no email", async ({ page }) => {
    await page.goto("/about");
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
    expect(await page.content()).not.toMatch(/mailto:|tel:/);
});

test("no page keeps the old design's roots, classes or tokens", async ({
    page,
}) => {
    for (const path of STATIC_PAGES) {
        await page.goto(path);
        const legacy = await page.evaluate(() => ({
            nodes: document.querySelectorAll(
                '[data-legacy], [class*="journal-"], [class*="career-"], [class*="fj-"], svg.lucide',
            ).length,
            tokens: Array.from(document.styleSheets).some((sheet) => {
                try {
                    return Array.from(sheet.cssRules).some((rule) =>
                        /--journal-|journal-|career-|data-legacy/.test(
                            rule.cssText,
                        ),
                    );
                } catch {
                    return false;
                }
            }),
        }));
        expect(legacy, path).toEqual({ nodes: 0, tokens: false });
    }
});
