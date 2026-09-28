import type { Page } from "@playwright/test";
import { expect, test } from "./support/test";
import { axeViolations } from "./support/axe";
import { MISSING_PAGES, STATIC_PAGES, contentPages } from "./support/routes";

/**
 * axe finds no violations on any page at 390 and 1440 px (plan §7.2),
 * apart from the documented allowances in support/axe.ts. The site has one
 * theme today; PR 7 adds the second and runs this per theme.
 */
async function expectNoViolations(page: Page, path: string, status = 200) {
    const response = await page.goto(path);
    expect(response?.status(), `${path} status`).toBe(status);
    await page.waitForLoadState("networkidle");
    expect(await axeViolations(page, path), `${path} axe`).toEqual([]);
}

for (const width of [390, 1440]) {
    test.describe(`axe at ${width}px`, () => {
        test.use({ viewport: { width, height: width < 600 ? 844 : 900 } });

        for (const path of STATIC_PAGES) {
            test(`${path} has no violations`, async ({ page }) => {
                await expectNoViolations(page, path);
            });
        }

        test("every post, tag and project page has no violations", async ({
            page,
            request,
        }, testInfo) => {
            const paths = await contentPages(request, testInfo);
            test.setTimeout(30_000 + paths.length * 15_000);
            for (const path of paths) {
                await test.step(path, () => expectNoViolations(page, path));
            }
        });

        test("the 404 page has no violations", async ({ page }) => {
            await expectNoViolations(page, MISSING_PAGES.unmatched, 404);
        });
    });
}
