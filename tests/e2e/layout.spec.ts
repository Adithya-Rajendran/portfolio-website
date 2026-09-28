import type { Page } from "@playwright/test";
import { expect, test } from "./support/test";
import { MISSING_PAGES, STATIC_PAGES, contentPages } from "./support/routes";

/** No page scrolls sideways at 320, 390, 1024 or 1440 px (plan §7.2). */
const WIDTHS = [320, 390, 1024, 1440];

async function expectNoSidewaysScroll(page: Page, path: string) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        const overflow = await page.evaluate(
            () =>
                document.documentElement.scrollWidth -
                document.documentElement.clientWidth,
        );
        expect(overflow, `${path} at ${width}px overflows by`).toBe(0);
    }
}

for (const path of [...STATIC_PAGES, MISSING_PAGES.unmatched]) {
    test(`${path} does not scroll sideways`, async ({ page }) => {
        await expectNoSidewaysScroll(page, path);
    });
}

test("no post, tag or project page scrolls sideways", async ({
    page,
    request,
}, testInfo) => {
    const paths = await contentPages(request, testInfo);
    test.setTimeout(30_000 + paths.length * 5_000);
    for (const path of paths) {
        await test.step(path, () => expectNoSidewaysScroll(page, path));
    }
});
