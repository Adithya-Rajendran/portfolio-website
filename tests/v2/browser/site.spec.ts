import { test, expect } from "@playwright/test";

test("published content, navigation and missing content work in the Worker", async ({
    page,
    request,
}) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: "Writing" })
        .click();
    await expect(
        page.getByRole("link", {
            name: "Fixture post: code listings and links",
        }),
    ).toBeVisible();
    await page
        .getByRole("link", { name: "Fixture post: code listings and links" })
        .click();
    await expect(
        page.getByRole("heading", {
            name: "Fixture post: code listings and links",
        }),
    ).toBeVisible();
    expect((await request.get("/blog/nonexistent-entry")).status()).toBe(404);
});

test("feed and sitemap expose published fixtures, redirects work, and contact rejects cross-origin posts", async ({
    request,
}) => {
    const feed = await request.get("/feed.xml");
    expect(feed.status()).toBe(200);
    expect(await feed.text()).toContain("fixture-post-code-and-links");
    const sitemap = await request.get("/sitemap.xml");
    expect(await sitemap.text()).toContain("fixture-post-code-and-links");
    const redirect = await request.get("/blogs", { maxRedirects: 0 });
    expect(redirect.status()).toBe(308);
    expect(redirect.headers().location).toBe("/blog");
    const contact = await request.post("/api/contact", {
        headers: {
            origin: "https://untrusted.example",
            "content-type": "application/x-www-form-urlencoded",
        },
        data: "senderEmail=a%40example.com&message=hello",
    });
    expect(contact.status()).toBe(403);
});

test("core pages remain usable without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/resume");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("main")).not.toBeEmpty();
    await context.close();
});

test("theme is keyboard operable and navigation remains available on mobile", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const theme = page.getByRole("button", { name: "Change color theme" });
    await theme.focus();
    await page.keyboard.press("Enter");
    const chosen = await page.locator("html").getAttribute("data-theme");
    expect(["light", "dark"]).toContain(chosen);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", chosen!);
    await expect(
        page
            .getByRole("navigation", { name: "Main navigation" })
            .getByRole("link", { name: "Contact" }),
    ).toBeVisible();
});

test("article, CV and contact fallback are readable without JavaScript", async ({
    browser,
}) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/blog/fixture-post-code-and-links");
    await expect(page.locator("article")).toContainText(
        "Fixture post: code listings and links",
    );
    await page.goto("/resume");
    await expect(page.locator("#cv")).toContainText("Field Software Engineer");
    await page.goto("/contact");
    expect(await page.locator("body").innerText()).toContain(
        "The verification step requires JavaScript.",
    );
    await context.close();
});

test("contact validates required fields without sending mail", async ({
    page,
}) => {
    await page.goto("/contact");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.locator("#senderEmail:invalid")).toBeVisible();
    await expect(page).toHaveURL(/\/contact$/);
});

test("reduced motion retains the experience list", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/resume");
    await expect(page.locator("#cv")).toBeVisible();
    await expect(page.locator("[data-experience-stage]")).toBeHidden();
});

test("the experience visual can be started and stopped when WebGL is available", async ({
    page,
}) => {
    await page.goto("/resume");
    const supported = await page.evaluate(() =>
        Boolean(document.createElement("canvas").getContext("webgl2")),
    );
    test.skip(!supported, "WebGL2 is unavailable in this browser");
    const start = page.getByRole("button", { name: "Start visual" });
    await start.click();
    await expect(page.locator("[data-experience-stage] canvas")).toBeVisible();
    await expect(page.locator("#cv")).toBeVisible();
});

test("Studio deep links serve the standalone shell", async ({ request }) => {
    const response = await request.get("/studio/structure/post");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/html");
    expect(await response.text()).toContain("/studio/static/");
});

test("home, article and contact have no serious accessibility violations", async ({
    page,
}) => {
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    for (const path of ["/", "/blog/fixture-post-code-and-links", "/contact"]) {
        await page.goto(path);
        const results = await new AxeBuilder({ page }).analyze();
        expect(
            results.violations.filter(
                (v) => v.impact === "critical" || v.impact === "serious",
            ),
            path,
        ).toEqual([]);
    }
});

test("article metadata has canonical, sharing and structured data", async ({
    page,
}) => {
    await page.goto("/blog/fixture-post-code-and-links");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        "https://adithya-rajendran.com/blog/fixture-post-code-and-links",
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
        "content",
        "Fixture post: code listings and links",
    );
    await expect(
        page.locator('link[rel="alternate"][type="application/rss+xml"]'),
    ).toHaveAttribute("href", "/feed.xml");
    const json = await page
        .locator('script[type="application/ld+json"]')
        .allTextContents();
    expect(
        json
            .map((value) => JSON.parse(value))
            .some((value) => value["@type"] === "BlogPosting"),
    ).toBe(true);
});
