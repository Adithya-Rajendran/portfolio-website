import { test, expect } from "@playwright/test";

test("article summaries, next reading and follow links work on a phone without JavaScript", async ({
    browser,
}) => {
    const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto("/blog/fixture-post-code-and-links");
    const takeaways = page.getByRole("complementary", {
        name: "Key takeaways",
    });
    await expect(takeaways).toBeVisible();
    expect((await takeaways.boundingBox())!.y).toBeLessThan(640);
    await expect(
        page.getByRole("link", { name: "Follow on LinkedIn" }),
    ).toHaveAttribute("href", "https://www.linkedin.com/in/adithya-rajendran");
    await expect(
        page.getByRole("link", { name: "Subscribe via RSS" }),
    ).toHaveAttribute("href", "/feed.xml");
    const next = page.getByRole("region", { name: "Read next" });
    await expect(next).toBeVisible();
    await next.getByRole("link").first().click();
    await expect(page).not.toHaveURL(/fixture-post-code-and-links$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
        ),
    ).toBe(true);
    await context.close();
});
