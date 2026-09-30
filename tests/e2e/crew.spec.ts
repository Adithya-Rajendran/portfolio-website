import { aboutCopy as copy, crewCopy, nowKinds } from "@/lib/copy";
import { expect, test } from "./support/test";
import { STATIC_PAGES } from "./support/routes";

/**
 * About (themed Crew File; plan §6.2 PR 14, contract §9; premium WS2):
 * the head with the patch as the identity mark and no portrait, the
 * profile record (Name, Studying, Previously, Focus, Links: no Open To or
 * edit date, no accent cell), the sections by their plain names
 * (background, the Now list by kind) and the way to get in touch; no
 * writing index or related pages repeating other pages, and no question
 * numbers; the page names no gap. And the old design is gone from every
 * page: no legacy root, class or token.
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
        record.getByRole("term").filter({ hasText: /^(Open to|Updated)$/i }),
    ).toHaveCount(0);
    await expect(record.locator(".titleblock__cell--accent")).toHaveCount(0);

    // The header carries Experience and CV; the head repeats neither,
    // and it has no dek: the record states the headline's facts.
    await expect(main.locator(".page-head__actions")).toHaveCount(0);
    await expect(main.locator(".page-head__intro")).toHaveCount(0);
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
        // A kind's label only when there is more than one kind.
        const kinds = now.getByRole("heading", { level: 3 });
        if (await kinds.count()) {
            expect(await kinds.count()).toBeGreaterThan(1);
            await expect(kinds.first()).toHaveText(
                new RegExp(`^(${Object.values(nowKinds).join("|")})$`, "i"),
            );
        }
        await expect(now.getByRole("listitem").first()).toBeVisible();
        // A question's words are its name: no Q1, Q2.
        await expect(now.getByText(/^Q\d+$/)).toHaveCount(0);
    }

    // The writing and the other sections have pages of their own.
    await expect(
        main.getByRole("region", { name: /^(Writing|Talks)/ }),
    ).toHaveCount(0);
    await expect(main.getByRole("navigation")).toHaveCount(0);

    const touch = main.getByRole("link", { name: copy.message });
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
