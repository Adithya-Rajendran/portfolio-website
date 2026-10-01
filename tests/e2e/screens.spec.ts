import type { APIRequestContext, Page, TestInfo } from "@playwright/test";
import { expect, test } from "./support/test";
import {
    MISSING_PAGES,
    STATIC_PAGES,
    contentPages,
    isPostPage,
} from "./support/routes";
import { storeTheme } from "./support/theme";

/**
 * Review screenshots for the PR, attached to the HTML report (and so to
 * the CI artifact): every static page, the newest post and the 404, at 390
 * and 1440 px, with and without JavaScript and in Flight Manual, plus
 * /resume printed on A4 and Letter. Nothing is compared against a baseline; the preview review is the
 * check (plan §7.3).
 */

const WIDTHS = [390, 1440];

function fileName(path: string, suffix: string): string {
    const slug = path === "/" ? "home" : path.slice(1).replaceAll("/", "-");
    return `${slug}-${suffix}`;
}

async function shoot(page: Page, testInfo: TestInfo, name: string) {
    const body = await page.screenshot({ fullPage: true });
    await testInfo.attach(`${name}.png`, { body, contentType: "image/png" });
}

async function reviewPaths(request: APIRequestContext, testInfo: TestInfo) {
    const posts = (await contentPages(request, testInfo)).filter(isPostPage);
    return [...STATIC_PAGES, ...posts.slice(0, 1), MISSING_PAGES.unmatched];
}

for (const javaScriptEnabled of [true, false]) {
    test.describe(
        javaScriptEnabled ? "with JavaScript" : "without JavaScript",
        () => {
            test.use({ javaScriptEnabled });

            test("screenshots", async ({ page, request }, testInfo) => {
                test.setTimeout(120_000);
                const mode = javaScriptEnabled ? "js" : "nojs";
                for (const path of await reviewPaths(request, testInfo)) {
                    for (const width of WIDTHS) {
                        await page.setViewportSize({ width, height: 900 });
                        await page.goto(path);
                        await page.waitForLoadState("networkidle");
                        await shoot(
                            page,
                            testInfo,
                            fileName(path, `${width}-${mode}`),
                        );
                    }
                }
            });
        },
    );
}

test("screenshots in Flight Manual", async ({ page, request }, testInfo) => {
    test.setTimeout(120_000);
    await storeTheme(page, "manual");
    for (const path of await reviewPaths(request, testInfo)) {
        for (const width of WIDTHS) {
            await page.setViewportSize({ width, height: 900 });
            await page.goto(path);
            await page.waitForLoadState("networkidle");
            await shoot(page, testInfo, fileName(path, `${width}-manual`));
        }
    }
});

test("/resume prints on A4 and Letter", async ({ page }, testInfo) => {
    await page.goto("/resume");
    await page.waitForLoadState("networkidle");
    await page.emulateMedia({ media: "print" });
    for (const format of ["A4", "Letter"]) {
        const pdf = await page.pdf({ format, printBackground: true });
        expect(pdf.byteLength).toBeGreaterThan(0);
        await testInfo.attach(`resume-${format}.pdf`, {
            body: pdf,
            contentType: "application/pdf",
        });
    }
});
