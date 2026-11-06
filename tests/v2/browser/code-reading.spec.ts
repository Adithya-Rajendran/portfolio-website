import { expect, test } from "@playwright/test";

const article = "/blog/fixture-post-code-and-links";

test("copying preserves each snippet and gives feedback without moving the article", async ({
    page,
    context,
}) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(article);
    const listings = page.locator(".listing");
    const snippets = [
        "echo fixture\nls -la",
        "echo fixture\n# A fixture comment long enough that this line scrolls inside the listing's box.\nls -la",
        "# A fixture namespace\napiVersion: v1\nkind: Namespace\nmetadata:\n  name: fixture",
    ];
    for (let i = 0; i < snippets.length; i++) {
        const listing = listings.nth(i);
        const button = listing.getByRole("button", { name: /Copy code from/ });
        await button.focus();
        const before = await listing.boundingBox();
        const controlBefore = await button.boundingBox();
        await page.keyboard.press("Enter");
        await expect(button).toHaveText("Copied");
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
            snippets[i],
        );
        await expect(listing.getByRole("status")).toHaveText(
            "Code copied to clipboard.",
        );
        expect(await listing.boundingBox()).toEqual(before);
        expect(await button.boundingBox()).toEqual(controlBefore);
        await expect(button).toHaveText("Copy");
    }
});

test("wide code scrolls by keyboard on mobile while the copy action stays in view", async ({
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(article);
    const listing = page.locator(".listing").nth(1);
    const region = listing.getByRole("region");
    const button = listing.getByRole("button", { name: /Copy code from/ });
    await button.focus();
    await page.keyboard.press("Tab");
    await expect(region).toBeFocused();
    const before = await button.boundingBox();
    await page.keyboard.press("ArrowRight");
    await expect
        .poll(() => region.evaluate((el) => el.scrollLeft))
        .toBeGreaterThan(0);
    expect(await button.boundingBox()).toEqual(before);
    await expect(button).toBeInViewport();
    expect(before!.height).toBeGreaterThanOrEqual(44);
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
        ),
    ).toBe(true);
    await page.keyboard.press("Tab");
    await expect(region).not.toBeFocused();
    await expect(listing.locator(":focus")).toHaveCount(0);
});

test("clipboard refusal offers a retry in place and does not report false success", async ({
    page,
}) => {
    await page.addInitScript(() => {
        let attempts = 0;
        Object.defineProperty(navigator, "clipboard", {
            value: {
                writeText: async () => {
                    if (++attempts === 1)
                        throw new DOMException(
                            "Permission denied",
                            "NotAllowedError",
                        );
                },
            },
        });
    });
    await page.goto(article);
    const listing = page.locator(".listing").first();
    const button = listing.getByRole("button", { name: /Copy code from/ });
    await button.focus();
    const before = await listing.boundingBox();
    await page.keyboard.press("Enter");
    await expect(button).toHaveText("Retry");
    await expect(listing.getByRole("status")).toContainText("Couldn't copy.");
    expect(await listing.boundingBox()).toEqual(before);
    await page.keyboard.press("Enter");
    await expect(button).toHaveText("Copied");
    expect(await listing.boundingBox()).toEqual(before);
});

test("code remains readable without JavaScript or a clipboard API", async ({
    browser,
}) => {
    for (const javaScriptEnabled of [false, true]) {
        const context = await browser.newContext({
            javaScriptEnabled,
            viewport: { width: 390, height: 844 },
        });
        if (javaScriptEnabled)
            await context.addInitScript(() => {
                Object.defineProperty(navigator, "clipboard", {
                    value: undefined,
                });
            });
        const page = await context.newPage();
        await page.goto(article);
        const listing = page.locator(".listing").first();
        await expect(listing.locator("code")).toHaveText(
            "echo fixture\nls -la",
        );
        await expect(listing.locator(".copy-code")).toBeHidden();
        await listing.getByRole("region").focus();
        await expect(listing.getByRole("region")).toBeFocused();
        await context.close();
    }
});

test("a delayed clipboard permission response keeps keyboard focus and suppresses duplicate writes", async ({
    page,
}) => {
    await page.addInitScript(() => {
        const state = { attempts: 0, refuse: () => {} };
        Object.assign(window, { clipboardTest: state });
        Object.defineProperty(navigator, "clipboard", {
            value: {
                writeText: () => {
                    state.attempts++;
                    if (state.attempts > 1) return Promise.resolve();
                    return new Promise<void>((_resolve, reject) => {
                        state.refuse = () =>
                            reject(
                                new DOMException(
                                    "Permission denied",
                                    "NotAllowedError",
                                ),
                            );
                    });
                },
            },
        });
    });
    await page.goto(article);
    const listing = page.locator(".listing").first();
    const button = listing.getByRole("button", { name: /Copy code from/ });
    const attempts = () =>
        page.evaluate(
            () =>
                (window as unknown as { clipboardTest: { attempts: number } })
                    .clipboardTest.attempts,
        );
    await button.focus();
    await page.keyboard.press("Enter");
    await expect.poll(attempts).toBe(1);
    await expect(button).toBeFocused();
    await page.keyboard.press("Enter");
    expect(await attempts()).toBe(1);
    await page.evaluate(() =>
        (
            window as unknown as { clipboardTest: { refuse: () => void } }
        ).clipboardTest.refuse(),
    );
    await expect(button).toHaveText("Retry");
    await expect(button).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(button).toHaveText("Copied");
    expect(await attempts()).toBe(2);
});
