import type { Page } from "@playwright/test";
import { expect, test } from "./support/test";
import { MISSING_PAGES, STATIC_PAGES, contentPages } from "./support/routes";

/**
 * No page scrolls sideways from 320 to 1920 px (plan §7.2), and the header
 * fits at every width: its parts stay inside the viewport without
 * overlapping. `body` clips horizontal overflow, which would hide a
 * sideways scroll, so the body's own scroll width is measured too.
 */
const WIDTHS = [320, 390, 600, 960, 1024, 1280, 1440, 1920];

async function expectNoSidewaysScroll(page: Page, path: string) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        const overflow = await page.evaluate(
            () =>
                Math.max(
                    document.documentElement.scrollWidth,
                    document.body.scrollWidth,
                ) - document.documentElement.clientWidth,
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

test("the header fits from 320 to 1920 px", async ({ page }) => {
    await page.goto("/blog");
    await page.waitForLoadState("networkidle");
    for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        const problems = await page.evaluate(() => {
            const visible = (element: Element) => {
                const box = element.getBoundingClientRect();
                return box.width > 0 && box.height > 0;
            };
            const boxes = [
                ...document.querySelectorAll(
                    ".site-header .brand, .site-header .nav__link, .site-header .header-tools > *",
                ),
            ]
                .filter(visible)
                .map((element) => ({
                    name:
                        element.getAttribute("aria-label") ??
                        element.textContent?.trim() ??
                        element.className,
                    box: element.getBoundingClientRect(),
                }));
            const out: string[] = [];
            const header = document
                .querySelector(".site-header")!
                .getBoundingClientRect();
            for (const { name, box } of boxes) {
                if (box.left < 0 || box.right > window.innerWidth) {
                    out.push(`${name} outside the viewport`);
                }
                if (box.top < header.top || box.bottom > header.bottom + 2) {
                    out.push(`${name} outside the header bar`);
                }
            }
            boxes.sort((a, b) => a.box.left - b.box.left);
            for (let i = 1; i < boxes.length; i++) {
                if (boxes[i].box.left < boxes[i - 1].box.right - 0.5) {
                    out.push(`${boxes[i - 1].name} overlaps ${boxes[i].name}`);
                }
            }
            return out;
        });
        expect(problems, `header at ${width}px`).toEqual([]);
    }
});
