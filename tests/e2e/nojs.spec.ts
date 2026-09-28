import type { Page } from "@playwright/test";
import { primaryNavigation } from "@/lib/navigation";
import { expect, test } from "./support/test";
import { MISSING_PAGES, STATIC_PAGES, contentPages } from "./support/routes";

/**
 * Without JavaScript every page is complete: the skip link, header, primary
 * navigation, one `main` with content, one `h1` and the footer, with nothing
 * held back in a streamed segment only JavaScript reveals and nothing
 * rendered twice (the defects PR 1 fixed).
 */
test.use({ javaScriptEnabled: false });

async function expectCompletePage(page: Page, path: string, status = 200) {
    const response = await page.goto(path);
    expect(response?.status(), `${path} status`).toBe(status);

    const main = page.getByRole("main");
    await expect(main).toHaveCount(1);
    await expect(main).toHaveAttribute("id", "main-content");
    await expect(main).not.toBeEmpty();
    await expect(page.locator('a[href="#main-content"]')).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

    const banner = page.getByRole("banner");
    await expect(banner).toBeVisible();
    for (const { label } of primaryNavigation) {
        await expect(
            banner.getByRole("link", { name: label, exact: true }),
        ).toBeVisible();
    }
    await expect(page.getByRole("contentinfo")).toBeVisible();

    // React streams a finished Suspense boundary that arrives after the
    // shell as <div hidden id="S:n">, which only its inline script reveals.
    await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0);

    const jsonLdTypes = (
        await page
            .locator('script[type="application/ld+json"]')
            .allTextContents()
    ).map((text) =>
        String((JSON.parse(text) as { "@type"?: unknown })["@type"]),
    );
    expect(
        jsonLdTypes.filter(
            (type, index) => jsonLdTypes.indexOf(type) !== index,
        ),
        "JSON-LD rendered twice",
    ).toEqual([]);
}

for (const width of [1440, 390]) {
    test.describe(`without JavaScript at ${width}px`, () => {
        test.use({ viewport: { width, height: 900 } });

        for (const path of STATIC_PAGES) {
            test(`${path} is complete`, async ({ page }) => {
                await expectCompletePage(page, path);
            });
        }

        test("every post, tag and project page is complete", async ({
            page,
            request,
        }, testInfo) => {
            const paths = await contentPages(request, testInfo);
            test.setTimeout(30_000 + paths.length * 5_000);
            for (const path of paths) {
                await test.step(path, () => expectCompletePage(page, path));
            }
        });

        for (const [kind, path] of Object.entries(MISSING_PAGES)) {
            test(`an unknown ${kind} URL shows the 404 page`, async ({
                page,
            }) => {
                // Known defect, not caused by the harness: an unknown slug
                // under a dynamic segment answers 404 with an error document
                // whose body only JavaScript renders. Production does the
                // same. Remove this line when the defect is fixed; the test
                // then has to pass.
                test.fail(
                    kind !== "unmatched",
                    "Unknown dynamic slugs render their 404 only with JavaScript",
                );
                await expectCompletePage(page, path, 404);
            });
        }
    });
}
