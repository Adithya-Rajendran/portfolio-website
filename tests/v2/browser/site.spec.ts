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

test("home introduces the owner and connects both hero destinations", async ({
    page,
}) => {
    await page.goto("/");
    await expect(
        page.getByRole("heading", {
            level: 1,
            name: "Building toward the unknown.",
        }),
    ).toBeVisible();
    await expect(page.locator(".home-hero")).toContainText("Adithya Rajendran");
    await expect(
        page.getByRole("link", { name: "Explore the work" }),
    ).toHaveAttribute("href", "/portfolio");
    await expect(
        page.getByRole("link", { name: "Enter orbit" }),
    ).toHaveAttribute("href", "/resume");
});

test("home stays readable without JavaScript and fits a mobile viewport", async ({
    browser,
}) => {
    const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto("/");
    await expect(
        page.getByRole("heading", {
            level: 1,
            name: "Building toward the unknown.",
        }),
    ).toBeVisible();
    await expect(
        page.getByRole("link", { name: "Explore the work" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Enter orbit" })).toBeVisible();
    await expect(page.locator("[data-home-poster]")).toBeVisible();
    await expect(page.locator("[data-home-stage] canvas")).toHaveCount(0);
    const dimensions = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
    await context.close();
});

test("home's decorative scene starts automatically and respects reduced motion", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const supported = await page.evaluate(() =>
        Boolean(document.createElement("canvas").getContext("webgl2")),
    );
    test.skip(!supported, "WebGL2 is unavailable in this browser");
    const visual = page.locator("[data-home-visual]");
    const stage = page.locator("[data-home-stage]");
    await expect(visual).toHaveAttribute("aria-hidden", "true");
    await expect(stage.locator("canvas")).toBeVisible({ timeout: 20000 });
    await expect(stage).toHaveAttribute("data-state", "paused");
    await expect(page.locator("[data-home-motion]")).toBeDisabled();
    await expect(page.locator("[data-home-poster]")).toBeHidden();
});

test("home uses the finished Blender scene without downloading authoring models", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const urls: string[] = [];
    page.on("request", (request) => urls.push(request.url()));
    await page.goto("/");
    const supported = await page.evaluate(() =>
        Boolean(document.createElement("canvas").getContext("webgl2")),
    );
    test.skip(!supported, "WebGL2 is unavailable in this browser");
    const stage = page.locator("[data-home-stage]");
    await expect(stage).toHaveAttribute("data-artwork", "blender", {
        timeout: 30000,
    });
    expect(
        urls.some((url) => url.includes("/images/scenes/horizon-v1.webp")),
    ).toBe(true);
    expect(urls.some((url) => /\.glb|\/three\/draco\//.test(url))).toBe(false);
    expect(
        urls.some((url) =>
            url.includes("/images/scenes/horizon-depth-v1.webp"),
        ),
    ).toBe(true);
});

test("home scene motion can be paused and resumed", async ({ page }) => {
    await page.goto("/");
    const supported = await page.evaluate(() =>
        Boolean(document.createElement("canvas").getContext("webgl2")),
    );
    test.skip(!supported, "WebGL2 is unavailable in this browser");
    const stage = page.locator("[data-home-stage]");
    await expect(stage.locator("canvas")).toBeVisible({ timeout: 20000 });
    await expect(stage).toHaveAttribute("data-state", "running");
    const motion = page.locator("[data-home-motion]");
    await motion.click();
    await expect(stage).toHaveAttribute("data-state", "paused");
    await expect(motion).toHaveText("Resume motion");
    await motion.click();
    await expect(stage).toHaveAttribute("data-state", "running");
});

test("home follows live motion preferences and preserves a manual pause", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    const supported = await page.evaluate(() =>
        Boolean(document.createElement("canvas").getContext("webgl2")),
    );
    test.skip(!supported, "WebGL2 is unavailable in this browser");
    const stage = page.locator("[data-home-stage]");
    const motion = page.locator("[data-home-motion]");
    await expect(stage.locator("canvas")).toBeVisible({ timeout: 20000 });
    await expect(stage).toHaveAttribute("data-state", "running");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(motion).toBeDisabled();
    await expect(motion).toHaveText("Motion reduced by system");
    await expect(stage).toHaveAttribute("data-state", "paused");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(motion).toBeEnabled();
    await expect(motion).toHaveText("Pause motion");
    await expect(stage).toHaveAttribute("data-state", "running");
    await motion.click();
    await expect(stage).toHaveAttribute("data-state", "paused");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(motion).toBeDisabled();
    await expect(motion).toHaveText("Motion reduced by system");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(motion).toBeEnabled();
    await expect(motion).toHaveText("Resume motion");
    await expect(stage).toHaveAttribute("data-state", "paused");
});

test("home falls back to its poster if the WebGL context is lost", async ({
    page,
}) => {
    await page.goto("/");
    const supported = await page.evaluate(() =>
        Boolean(document.createElement("canvas").getContext("webgl2")),
    );
    test.skip(!supported, "WebGL2 is unavailable in this browser");
    const canvas = page.locator("[data-home-stage] canvas");
    await expect(canvas).toBeVisible({ timeout: 20000 });
    const lost = await canvas.evaluate((element) => {
        const gl = (element as HTMLCanvasElement).getContext("webgl2");
        const extension = gl?.getExtension("WEBGL_lose_context");
        extension?.loseContext();
        return Boolean(extension);
    });
    test.skip(!lost, "WEBGL_lose_context is unavailable in this browser");
    await expect(page.locator("[data-home-poster]")).toBeVisible();
    await expect(canvas).toHaveCount(0);
    await expect(
        page.getByRole("heading", {
            level: 1,
            name: "Building toward the unknown.",
        }),
    ).toBeVisible();
});

test("home hero has no serious accessibility issues in either theme", async ({
    page,
}) => {
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    await page.goto("/");
    for (const theme of ["light", "dark"]) {
        await page.evaluate(
            (value) => localStorage.setItem("theme", value),
            theme,
        );
        await page.reload();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const results = await new AxeBuilder({ page })
            .include(".home-hero")
            .analyze();
        expect(
            results.violations.filter(
                (v) => v.impact === "serious" || v.impact === "critical",
            ),
            theme,
        ).toEqual([]);
    }
});

test("security policy permits Cloudflare's injected analytics beacon", async ({
    request,
}) => {
    for (const path of ["/", "/studio/"]) {
        const response = await request.get(path);
        const policy = response.headers()["content-security-policy"];
        expect(policy).toBeTruthy();
        const directives = Object.fromEntries(
            policy.split(";").map((part) => {
                const [name, ...values] = part.trim().split(/\s+/);
                return [name, values];
            }),
        );
        expect(directives["script-src"]).toContain(
            "https://static.cloudflareinsights.com",
        );
        expect(directives["script-src"]).not.toContain("*");
        expect(directives["connect-src"]).toContain("'self'");
    }
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
    await expect(page.locator("#cv")).toBeVisible();
    await expect(page.locator("[data-experience-poster]")).toBeVisible();
    await expect(page.locator("[data-experience-stage] canvas")).toHaveCount(0);
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

test("dark is the default, an explicit light choice persists and navigation marks the current page", async ({
    page,
}) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
    await page.getByRole("button", { name: "Change color theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: "Experience" })
        .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(
        page
            .getByRole("navigation", { name: "Main navigation" })
            .getByRole("link", { name: "Experience" }),
    ).toHaveAttribute("aria-current", "page");
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

test("reduced motion renders a static visual while retaining the experience list", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/resume");
    const supported = await page.evaluate(() =>
        Boolean(document.createElement("canvas").getContext("webgl2")),
    );
    test.skip(!supported, "WebGL2 is unavailable in this browser");
    await expect(page.locator("[data-experience-stage] canvas")).toBeVisible();
    await expect(page.locator("#cv")).toBeVisible();
    await expect(
        page.getByRole("button", { name: "Motion reduced by system" }),
    ).toBeDisabled();
});

test("orbital controls change and reset the camera, select worlds, and retain the record on context loss", async ({
    page,
}) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
        if (
            message.type() === "error" &&
            /shader|webgl|three/i.test(message.text())
        )
            errors.push(message.text());
    });
    await page.goto("/resume");
    const supported = await page.evaluate(() =>
        Boolean(document.createElement("canvas").getContext("webgl2")),
    );
    test.skip(!supported, "WebGL2 is unavailable in this browser");
    const stage = page.locator("[data-experience-stage]");
    const canvas = stage.locator("canvas");
    await expect(canvas).toBeVisible({ timeout: 20000 });
    await expect(stage).toHaveAttribute("data-world", "earth");
    await page.getByRole("button", { name: "Pause motion" }).click();
    await expect(
        page.getByRole("button", { name: "Resume motion" }),
    ).toBeVisible();
    const initialCamera = await stage.getAttribute("data-camera");
    const initialDistance = Number(await stage.getAttribute("data-distance"));
    expect(initialCamera).toBeTruthy();
    expect(initialDistance).toBeGreaterThan(0);
    await stage.focus();
    await page.keyboard.press("ArrowLeft");
    await expect
        .poll(() => stage.getAttribute("data-camera"))
        .not.toBe(initialCamera);
    const box = await stage.boundingBox();
    expect(box).not.toBeNull();
    const x = box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;
    const beforeDrag = await stage.getAttribute("data-camera");
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 70, y + 20, { steps: 8 });
    await page.mouse.up();
    await expect
        .poll(() => stage.getAttribute("data-camera"))
        .not.toBe(beforeDrag);
    await stage.focus();
    await page.keyboard.press("+");
    await expect
        .poll(async () => Number(await stage.getAttribute("data-distance")))
        .toBeLessThan(initialDistance);
    await page.getByRole("button", { name: "Reset view" }).click();
    await expect
        .poll(async () =>
            Math.abs(
                Number(await stage.getAttribute("data-distance")) -
                    initialDistance,
            ),
        )
        .toBeLessThan(0.1);
    const initialPosition = initialCamera!.split(",").map(Number);
    await expect
        .poll(async () => {
            const actual = (await stage.getAttribute("data-camera"))!
                .split(",")
                .map(Number);
            return Math.hypot(
                ...actual.map((value, index) => value - initialPosition[index]),
            );
        })
        .toBeLessThan(0.3);
    await page.getByRole("button", { name: "Saturn", exact: true }).click();
    await expect(stage).toHaveAttribute("data-world", "saturn");
    await expect(
        page.getByRole("button", { name: "Saturn", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Earth", exact: true }).click();
    await expect(stage).toHaveAttribute("data-world", "earth");
    expect(errors).toEqual([]);
    const canLoseContext = await stage.locator("canvas").evaluate((element) => {
        const gl = (element as HTMLCanvasElement).getContext("webgl2");
        const extension = gl?.getExtension("WEBGL_lose_context");
        extension?.loseContext();
        return Boolean(extension);
    });
    if (canLoseContext) {
        await expect(stage.locator("canvas")).toHaveCount(0);
        await expect(page.locator("[data-experience-poster]")).toBeVisible();
        await expect(page.locator("#cv")).toBeVisible();
        await page.getByRole("button", { name: "Try again" }).click();
        await expect(stage.locator("canvas")).toBeVisible({ timeout: 20000 });
        await expect(stage.locator("canvas")).toHaveCount(1);
    }
});

test("scrolling moves between planets with a pullback and reverses", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/resume");
    const supported = await page.evaluate(() =>
        Boolean(document.createElement("canvas").getContext("webgl2")),
    );
    test.skip(!supported, "WebGL2 is unavailable in this browser");
    const stage = page.locator("[data-experience-stage]");
    await expect(stage.locator("canvas")).toBeVisible({ timeout: 20000 });
    await expect(stage).toHaveAttribute("data-world", "earth");
    await expect
        .poll(async () => Number(await stage.getAttribute("data-distance")))
        .toBeGreaterThan(0);
    const restDistance = Number(await stage.getAttribute("data-distance"));
    const nextKnot = await page.evaluate(() => {
        const entries = [
            ...document.querySelectorAll<HTMLElement>("[data-journey-step]"),
        ];
        const positions = entries.map((entry) =>
            Math.max(
                0,
                entry.getBoundingClientRect().top +
                    scrollY -
                    innerHeight * 0.36,
            ),
        );
        const end = Math.max(
            innerHeight * 2,
            (document.querySelector("#cv")?.getBoundingClientRect().bottom ||
                0) +
                scrollY -
                innerHeight * 0.7,
        );
        return positions.length >= 5
            ? Math.max(120, positions[Math.round((positions.length - 1) / 4)])
            : end / 4;
    });
    await page.evaluate(
        (y) => window.scrollTo({ top: y, behavior: "instant" }),
        nextKnot * 0.69,
    );
    await expect
        .poll(async () => Number(await stage.getAttribute("data-transition")), {
            timeout: 15000,
        })
        .toBeGreaterThan(0.3);
    await expect
        .poll(async () => Number(await stage.getAttribute("data-distance")), {
            timeout: 15000,
        })
        .toBeGreaterThan(restDistance + 0.5);
    await page.evaluate(
        (y) => window.scrollTo({ top: y, behavior: "instant" }),
        nextKnot,
    );
    await expect(stage).toHaveAttribute("data-world", "moon", {
        timeout: 15000,
    });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(stage).toHaveAttribute("data-world", "earth", {
        timeout: 15000,
    });
});

test("reduced-motion scrolling switches planets without a travelling animation", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/resume");
    const supported = await page.evaluate(() =>
        Boolean(document.createElement("canvas").getContext("webgl2")),
    );
    test.skip(!supported, "WebGL2 is unavailable in this browser");
    const stage = page.locator("[data-experience-stage]");
    await expect(stage.locator("canvas")).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: "Moon", exact: true }).click();
    await expect(stage).toHaveAttribute("data-world", "moon", {
        timeout: 15000,
    });
    await expect(stage).toHaveAttribute("data-transition", "0.0000");
    await expect(stage).toHaveAttribute("data-state", "paused");
});

test("a missing later planet keeps the current view and can be retried", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    let unavailable = true;
    let attempts = 0;
    await page.route("**/images/trajectory/moon-1k.webp", async (route) => {
        attempts++;
        if (unavailable) await route.abort();
        else await route.continue();
    });
    await page.goto("/resume");
    const supported = await page.evaluate(() =>
        Boolean(document.createElement("canvas").getContext("webgl2")),
    );
    test.skip(!supported, "WebGL2 is unavailable in this browser");
    const stage = page.locator("[data-experience-stage]");
    await expect(stage).toHaveAttribute("data-world", "earth", {
        timeout: 20000,
    });
    await page.getByRole("button", { name: "Moon", exact: true }).click();
    await expect(page.locator("[data-experience-status]")).toContainText(
        "Moon could not load",
    );
    await expect(stage).toHaveAttribute("data-world", "earth");
    await expect(stage.locator("canvas")).toBeVisible();
    expect(attempts).toBeLessThanOrEqual(2);
    unavailable = false;
    await page.getByRole("button", { name: "Moon", exact: true }).click();
    await expect(stage).toHaveAttribute("data-world", "moon", {
        timeout: 15000,
    });
});

test("experience chapter links reach the record and scrolling over the scene moves the page", async ({
    page,
}) => {
    await page.goto("/resume");
    await expect(
        page.getByRole("link", { name: /Explore projects/ }),
    ).toHaveAttribute("href", "/portfolio");
    await page.getByText("Explore chapters", { exact: true }).click();
    const chapters = page.getByRole("navigation", {
        name: "Experience chapters",
    });
    const first = chapters.locator('a[href^="#"]').first();
    const target = await first.getAttribute("href");
    expect(target).toBeTruthy();
    await first.click();
    await expect(page).toHaveURL(new RegExp(`${target}$`));
    await expect(page.locator(target!)).toBeVisible();
    const stage = page.locator("[data-experience-stage]");
    const supported = await page.evaluate(() =>
        Boolean(document.createElement("canvas").getContext("webgl2")),
    );
    test.skip(!supported, "WebGL2 is unavailable in this browser");
    await stage.scrollIntoViewIfNeeded();
    await expect(stage.locator("canvas")).toBeVisible({ timeout: 20000 });
    const bounds = await stage.boundingBox();
    expect(bounds).not.toBeNull();
    await page.mouse.move(
        bounds!.x + bounds!.width / 2,
        bounds!.y + bounds!.height / 2,
    );
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 300);
    await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(before);
});

test("experience remains scrollable over the visual on a narrow screen", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/resume");
    const stage = page.locator("[data-experience-stage]");
    const supported = await page.evaluate(() =>
        Boolean(document.createElement("canvas").getContext("webgl2")),
    );
    test.skip(!supported, "WebGL2 is unavailable in this browser");
    await stage.scrollIntoViewIfNeeded();
    await expect(stage.locator("canvas")).toBeVisible({ timeout: 20000 });
    const bounds = await stage.boundingBox();
    expect(bounds).not.toBeNull();
    await page.mouse.move(
        bounds!.x + bounds!.width / 2,
        bounds!.y + bounds!.height / 2,
    );
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 300);
    await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(before);
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

test("ordinary articles do not download the orbital renderer or maps", async ({
    page,
}) => {
    const sceneRequests: string[] = [];
    page.on("request", (request) => {
        const url = request.url();
        if (
            /\/images\/trajectory\/|\/models\/nasa-perseverance\.glb|\/three\/draco\/|\/three\.module\.|\/GLTFLoader\.|\/DRACOLoader\.|\/OrbitControls\.|\/ExperienceVisual\.|\/HeroVisual\./i.test(
                url,
            )
        )
            sceneRequests.push(url);
    });
    await page.goto("/blog/fixture-post-code-and-links");
    await expect(page.locator("article")).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(sceneRequests).toEqual([]);
});
