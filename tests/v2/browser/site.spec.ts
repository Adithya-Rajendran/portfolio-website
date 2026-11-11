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
    await expect(stage).toHaveAttribute("data-reveal", "ready", {
        timeout: 60000,
    });
    await expect(stage.locator("canvas")).toBeVisible();
    await expect(stage).toHaveAttribute("data-state", "paused");
    await expect(page.locator("[data-home-motion]")).toBeDisabled();
    await expect(page.locator("[data-home-poster]")).toBeHidden();
});

test("home loads the native rover scene", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const urls: string[] = [];
    const errors: string[] = [];
    page.on("request", (request) => urls.push(request.url()));
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
    });
    await page.goto("/");
    const stage = page.locator("[data-home-stage]");
    await expect(stage).toHaveAttribute("data-reveal", "ready", {
        timeout: 30000,
    });
    await expect(stage).toHaveAttribute("data-artwork", "rover-3d");
    expect(
        urls.some(
            (url) => new URL(url).pathname === "/models/home-rover-v1.glb",
        ),
    ).toBe(true);
    expect(errors).toEqual([]);
});

test("home scene follows the mouse, returns to center and freezes motion", async ({
    page,
}) => {
    test.setTimeout(150_000);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    const stage = page.locator("[data-home-stage]");
    const hero = page.locator(".home-hero");
    const motion = page.locator("[data-home-motion]");
    await expect(stage).toHaveAttribute("data-reveal", "ready", {
        timeout: 60000,
    });
    const box = await hero.boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error("Home hero has no bounds");
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.3);
    await expect
        .poll(async () => Number(await stage.getAttribute("data-view-x")), {
            timeout: 15000,
        })
        .toBeGreaterThan(0.2);
    await page.mouse.move(0, 0);
    await expect
        .poll(
            async () =>
                Math.abs(Number(await stage.getAttribute("data-view-x"))),
            { timeout: 45000 },
        )
        .toBeLessThan(0.05);
    await motion.click();
    await expect(stage).toHaveAttribute("data-state", "paused");
    const paused = await stage.getAttribute("data-view-x");
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.3);
    await page.waitForTimeout(700);
    expect(await stage.getAttribute("data-view-x")).toBe(paused);
    await motion.click();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(stage).toHaveAttribute("data-state", "paused");
    const reduced = await stage.getAttribute("data-view-x");
    await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.7);
    await page.waitForTimeout(700);
    expect(await stage.getAttribute("data-view-x")).toBe(reduced);
});

for (const width of [320, 390, 768, 1440]) {
    test(`home remains stable while the rover loads at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        let release!: () => void;
        const blocked = new Promise<void>((resolve) => {
            release = resolve;
        });
        let requested!: () => void;
        const requestSeen = new Promise<void>((resolve) => {
            requested = resolve;
        });
        await page.route("**/models/home-rover-v1.glb", async (route) => {
            requested();
            await blocked;
            await route.continue();
        });
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await requestSeen;
        const hero = page.locator(".home-hero");
        const heading = page.getByRole("heading", {
            level: 1,
            name: "Building toward the unknown.",
        });
        await expect(page.locator("[data-home-poster]")).toBeVisible();
        const before = await hero.boundingBox();
        const headingBefore = await heading.boundingBox();
        release();
        await expect(page.locator("[data-home-stage]")).toHaveAttribute(
            "data-reveal",
            "ready",
            { timeout: 30000 },
        );
        expect(await hero.boundingBox()).toEqual(before);
        expect(await heading.boundingBox()).toEqual(headingBefore);
        await expect(
            page.getByRole("link", { name: "Explore the work" }),
        ).toBeVisible();
        await expect(
            page.getByRole("link", { name: "Enter orbit" }),
        ).toBeVisible();
        const dimensions = await page.evaluate(() => ({
            width: document.documentElement.clientWidth,
            scroll: document.documentElement.scrollWidth,
        }));
        expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
    });
}

test("home retains its poster during reveal and ignores pointer input while loading", async ({
    page,
}) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
        release = resolve;
    });
    let requested!: () => void;
    const requestSeen = new Promise<void>((resolve) => {
        requested = resolve;
    });
    await page.route("**/models/home-rover-v1.glb", async (route) => {
        requested();
        await blocked;
        await route.continue();
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await requestSeen;
    const stage = page.locator("[data-home-stage]");
    const poster = page.locator("[data-home-poster]");
    await expect(poster).toBeVisible();
    await page.evaluate(() => {
        const stage = document.querySelector<HTMLElement>("[data-home-stage]")!;
        const poster =
            document.querySelector<HTMLElement>("[data-home-poster]")!;
        const snapshots: Array<{
            phase: string | undefined;
            posterHidden: boolean;
            x: string | undefined;
            y: string | undefined;
        }> = [];
        Object.assign(window, { homeRevealSnapshots: snapshots });
        new MutationObserver(() =>
            snapshots.push({
                phase: stage.dataset.reveal,
                posterHidden: poster.hidden,
                x: stage.dataset.viewX,
                y: stage.dataset.viewY,
            }),
        ).observe(stage, {
            attributes: true,
            attributeFilter: ["data-reveal"],
        });
    });
    const hero = await page.locator(".home-hero").boundingBox();
    expect(hero).not.toBeNull();
    if (!hero) throw new Error("Home hero has no bounds");
    await page.mouse.move(
        hero.x + hero.width * 0.85,
        hero.y + hero.height * 0.3,
    );
    release();
    await expect(stage).toHaveAttribute("data-reveal", "ready", {
        timeout: 60000,
    });
    const snapshots = await page.evaluate(
        () =>
            (
                window as unknown as {
                    homeRevealSnapshots: Array<{
                        phase: string;
                        posterHidden: boolean;
                        x?: string;
                        y?: string;
                    }>;
                }
            ).homeRevealSnapshots,
    );
    const fading = snapshots.find((snapshot) => snapshot.phase === "fading");
    const ready = snapshots.find((snapshot) => snapshot.phase === "ready");
    expect(fading).toMatchObject({
        posterHidden: false,
        x: "0.0000",
        y: "0.0000",
    });
    expect(ready).toMatchObject({
        posterHidden: true,
        x: "0.0000",
        y: "0.0000",
    });
    await expect(poster).toBeHidden();
});

test("home poster and first rover frame stay aligned at desktop cover crop", async ({
    page,
}) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const stage = page.locator("[data-home-stage]");
    await expect(stage).toHaveAttribute("data-reveal", "ready", {
        timeout: 60000,
    });
    await page.addStyleTag({
        content:
            ".home-hero__content, .home-hero__veil, .home-hero__motion, .home-hero__map-credit { visibility: hidden !important; }",
    });
    const clip = { x: 900, y: 370, width: 720, height: 450 };
    const actual = await page.screenshot({ clip });
    await page.evaluate(() => {
        document.querySelector<HTMLElement>("[data-home-poster]")!.hidden =
            false;
        document.querySelector<HTMLElement>(
            "[data-home-stage]",
        )!.style.opacity = "0";
    });
    const poster = await page.screenshot({ clip });
    const { default: sharp } = await import("sharp");
    const renderedPixels = await sharp(actual).removeAlpha().raw().toBuffer();
    const posterPixels = await sharp(poster).removeAlpha().raw().toBuffer();
    expect(renderedPixels.length).toBe(posterPixels.length);
    let difference = 0;
    for (let i = 0; i < renderedPixels.length; i++)
        difference += Math.abs(renderedPixels[i] - posterPixels[i]);
    expect(difference / renderedPixels.length).toBeLessThan(10);
});

test("home recovers when a page is restored while the rover is loading", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
        release = resolve;
    });
    let requested!: () => void;
    const requestSeen = new Promise<void>((resolve) => {
        requested = resolve;
    });
    await page.route("**/models/home-rover-v1.glb", async (route) => {
        requested();
        await blocked;
        await route.continue();
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await requestSeen;
    await page.evaluate(() => {
        window.dispatchEvent(
            new PageTransitionEvent("pagehide", { persisted: true }),
        );
        window.dispatchEvent(
            new PageTransitionEvent("pageshow", { persisted: true }),
        );
    });
    release();
    const stage = page.locator("[data-home-stage]");
    await expect(stage).toHaveAttribute("data-reveal", "ready", {
        timeout: 30000,
    });
    await expect(stage.locator("canvas")).toHaveCount(1);
    await expect(page.locator("[data-home-poster]")).toBeHidden();
});

test("home keeps its poster and content if the rover model fails", async ({
    page,
}) => {
    await page.route("**/models/home-rover-v1.glb", (route) => route.abort());
    await page.goto("/");
    await expect(page.locator("[data-home-stage]")).toHaveAttribute(
        "data-state",
        "error",
        { timeout: 30000 },
    );
    await expect(page.locator("[data-home-poster]")).toBeVisible();
    await expect(
        page.getByRole("heading", {
            level: 1,
            name: "Building toward the unknown.",
        }),
    ).toBeVisible();
    await expect(
        page.getByRole("link", { name: "Explore the work" }),
    ).toBeVisible();
});

test("home scene motion can be paused and resumed", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/");
    const supported = await page.evaluate(() =>
        Boolean(document.createElement("canvas").getContext("webgl2")),
    );
    test.skip(!supported, "WebGL2 is unavailable in this browser");
    const stage = page.locator("[data-home-stage]");
    await expect(stage).toHaveAttribute("data-reveal", "ready", {
        timeout: 60000,
    });
    await expect(stage.locator("canvas")).toBeVisible();
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
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    const supported = await page.evaluate(() =>
        Boolean(document.createElement("canvas").getContext("webgl2")),
    );
    test.skip(!supported, "WebGL2 is unavailable in this browser");
    const stage = page.locator("[data-home-stage]");
    const motion = page.locator("[data-home-motion]");
    await expect(stage).toHaveAttribute("data-reveal", "ready", {
        timeout: 60000,
    });
    await expect(stage.locator("canvas")).toBeVisible();
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
    await expect(page.locator("[data-home-stage]")).toHaveAttribute(
        "data-reveal",
        "ready",
        { timeout: 60000 },
    );
    await expect(canvas).toBeVisible();
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
    await expect(page.locator("[data-experience-poster]")).toHaveCount(0);
    await expect(page.locator("[data-experience-stage] canvas")).toHaveCount(0);
    expect(await page.locator("body").innerText()).toContain(
        "The interactive orbital view requires JavaScript.",
    );
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

test("featured non-quiet projects lead the linked project list", async ({
    page,
}) => {
    await page.goto("/portfolio");
    const projectLinks = page.locator('main a[href^="/portfolio/"]');
    await expect(projectLinks.nth(0)).toHaveAttribute(
        "href",
        "/portfolio/homelab",
    );
    await expect(projectLinks.nth(1)).toHaveAttribute(
        "href",
        "/portfolio/fixture-flagship-mission",
    );
    const links = await projectLinks.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("href")),
    );
    expect(links.indexOf("/portfolio/fixture-planned-mission")).toBeGreaterThan(
        1,
    );
    await projectLinks.nth(1).click();
    await expect(page).toHaveURL(/\/portfolio\/fixture-flagship-mission$/);
    await expect(
        page.getByRole("heading", {
            level: 1,
            name: "Fixture flagship mission",
        }),
    ).toBeVisible();
});

test("article, CV and contact fallback are readable without JavaScript", async ({
    browser,
}) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/blog/fixture-post-code-and-links");
    const article = page.locator("article");
    await expect(article).toContainText(
        "Fixture post: code listings and links",
    );
    await expect(article).toContainText("Fixture caution");
    await expect(article).toContainText("Fixture footnote one");
    const summary = article.locator("summary").filter({ hasText: "Contents" });
    await summary.focus();
    await page.keyboard.press("Enter");
    const contents = page.getByRole("navigation", { name: "Contents" });
    const link = contents.getByRole("link", { name: "Fixture second section" });
    const target = await link.getAttribute("href");
    expect(target).toBeTruthy();
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${target}$`));
    await expect(page.locator(target!)).toBeVisible();
    const back = article.getByRole("link", { name: "Back to contents" });
    await back.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#article-contents$/);
    await expect(summary).toBeVisible();
    for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(
            article.getByRole("heading", { name: "Fixture section in a post" }),
        ).toBeVisible();
        await expect(
            article.getByRole("heading", { name: "Fixture second section" }),
        ).toBeVisible();
        const dimensions = await page.evaluate(() => ({
            width: document.documentElement.clientWidth,
            scroll: document.documentElement.scrollWidth,
        }));
        expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
    }
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
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto("/contact");
    const form = page.locator("#contact-form");
    const study = page.locator('figure[data-space-study="relay"]');
    const linkedIn = page.getByRole("link", { name: /LinkedIn/ }).first();
    await expect(form).toBeVisible();
    await expect(study).toBeAttached();
    await expect(linkedIn).toBeAttached();
    const formPrecedes = await form.evaluate((element) => {
        const study = document.querySelector(
            'figure[data-space-study="relay"]',
        );
        const linkedIn = document.querySelector('main a[href*="linkedin.com"]');
        return Boolean(
            study &&
            linkedIn &&
            element.compareDocumentPosition(study) &
                Node.DOCUMENT_POSITION_FOLLOWING &&
            element.compareDocumentPosition(linkedIn) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        );
    });
    expect(formPrecedes).toBe(true);
    for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        const dimensions = await page.evaluate(() => ({
            width: document.documentElement.clientWidth,
            scroll: document.documentElement.scrollWidth,
        }));
        expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
    }
    await page.getByRole("button", { name: "Send message" }).focus();
    await page.keyboard.press("Enter");
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
    const stage = page.locator("[data-experience-stage]");
    await expect(stage).toHaveAttribute("data-ready", "true", {
        timeout: 60000,
    });
    await expect(stage.locator("canvas")).toBeVisible();
    await expect(page.locator("#cv")).toBeVisible();
    await expect(
        page.getByRole("button", { name: "Motion reduced by system" }),
    ).toBeDisabled();
});

test("orbital controls change and reset the camera, select worlds, and retain the record on context loss", async ({
    page,
}) => {
    test.setTimeout(120000);
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
    await expect(stage).toHaveAttribute("data-satellites", "2");
    await page.getByRole("button", { name: "Pause motion" }).click();
    await expect(
        page.getByRole("button", { name: "Resume motion" }),
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(stage).toHaveAttribute("data-state", "paused");
    await expect(stage).toHaveAttribute("data-world", "earth");
    await expect(stage).toHaveAttribute("data-view", "orbit");
    const initialCamera = await stage.getAttribute("data-camera");
    const initialDistance = Number(await stage.getAttribute("data-distance"));
    expect(initialCamera).toBeTruthy();
    expect(initialDistance).toBeGreaterThan(0);
    const explore = page.getByRole("button", { name: "Explore scene" });
    await explore.click();
    await expect(stage).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(stage).toHaveAttribute("data-navigation", "manual");
    await expect
        .poll(() => stage.getAttribute("data-camera"))
        .not.toBe(initialCamera);
    const box = await stage.boundingBox();
    expect(box).not.toBeNull();
    const x = box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;
    const beforePan = await stage.getAttribute("data-camera-target");
    await page.keyboard.press("Shift+ArrowRight");
    await expect
        .poll(() => stage.getAttribute("data-camera-target"))
        .not.toBe(beforePan);
    const beforeRightDrag = await stage.getAttribute("data-camera-target");
    await page.mouse.move(x, y);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(x + 45, y + 10, { steps: 4 });
    await page.mouse.up({ button: "right" });
    await expect
        .poll(() => stage.getAttribute("data-camera-target"))
        .not.toBe(beforeRightDrag);
    const beforeDrag = await stage.getAttribute("data-camera");
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 70, y + 20, { steps: 8 });
    await page.mouse.up();
    await expect(stage).toHaveAttribute("data-navigation", "manual");
    await expect
        .poll(() => stage.getAttribute("data-camera"))
        .not.toBe(beforeDrag);
    const manualCamera = await stage.getAttribute("data-camera");
    await page.waitForTimeout(750);
    expect(await stage.getAttribute("data-camera")).toBe(manualCamera);
    await stage.focus();
    await page.keyboard.press("+");
    await expect
        .poll(async () => Number(await stage.getAttribute("data-distance")))
        .toBeLessThan(initialDistance);
    const beforeWheel = Number(await stage.getAttribute("data-distance"));
    const beforeScroll = await page.evaluate(() => scrollY);
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, 180);
    await expect
        .poll(async () => Number(await stage.getAttribute("data-distance")))
        .toBeGreaterThan(beforeWheel);
    expect(await page.evaluate(() => scrollY)).toBe(beforeScroll);
    await page.getByRole("button", { name: "Reset view" }).click();
    await expect(stage).toHaveAttribute(
        "data-camera-target",
        "0.000000,0.000000,0.000000",
    );
    await expect(stage).toHaveAttribute("data-navigation", "manual");
    await expect(page.getByRole("button", { name: "Done" })).toHaveAttribute(
        "aria-expanded",
        "true",
    );
    await page.keyboard.press("Escape");
    await expect(explore).toBeFocused();
    await expect(explore).toHaveAttribute("aria-expanded", "false");
    await expect(stage).toHaveAttribute("data-navigation", "guided");
    await page.getByRole("button", { name: "Replay the guided tour" }).click();
    await expect(stage).toHaveAttribute("data-navigation", "guided");
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
        await expect(page.locator("[data-experience-poster]")).toHaveCount(0);
        await expect(page.locator("[data-experience-status]")).toContainText(
            "The visual is unavailable",
        );
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
    await stage.evaluate((element) => {
        const samples = { transition: 0, distance: 0 };
        Object.assign(window, { pullbackSamples: samples });
        new MutationObserver(() => {
            samples.transition = Math.max(
                samples.transition,
                Number(element.getAttribute("data-transition")),
            );
            samples.distance = Math.max(
                samples.distance,
                Number(element.getAttribute("data-distance")),
            );
        }).observe(element, {
            attributes: true,
            attributeFilter: ["data-transition", "data-distance"],
        });
    });
    await page
        .locator('[data-journey-world="moon"]')
        .evaluate((element) =>
            element.scrollIntoView({ block: "center", behavior: "instant" }),
        );
    await expect
        .poll(
            async () =>
                page.evaluate(
                    () =>
                        (
                            window as unknown as {
                                pullbackSamples: { transition: number };
                            }
                        ).pullbackSamples.transition,
                ),
            {
                timeout: 15000,
            },
        )
        .toBeGreaterThan(0.3);
    await expect
        .poll(
            async () =>
                page.evaluate(
                    () =>
                        (
                            window as unknown as {
                                pullbackSamples: { distance: number };
                            }
                        ).pullbackSamples.distance,
                ),
            {
                timeout: 15000,
            },
        )
        .toBeGreaterThan(restDistance + 0.5);
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
    await page.route(
        "**/images/trajectory/moon-surface-v2-*.webp",
        async (route) => {
            attempts++;
            if (unavailable) await route.abort();
            else await route.continue();
        },
    );
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

test("Moon and Mars arrive at their surface studies", async ({ page }) => {
    const outpostRequests: string[] = [];
    page.on("request", (request) => {
        // The full model, or the lighter one a small or software-drawn
        // display is given.
        if (/\/models\/(moon|mars)-outpost(-lite)?-v3\.glb/.test(request.url()))
            outpostRequests.push(request.url());
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/resume");
    const supported = await page.evaluate(() =>
        Boolean(document.createElement("canvas").getContext("webgl2")),
    );
    test.skip(!supported, "WebGL2 is unavailable in this browser");
    const stage = page.locator("[data-experience-stage]");
    await expect(stage.locator("canvas")).toBeVisible({ timeout: 20000 });
    await expect(stage).toHaveAttribute("data-world", "earth");
    await page.waitForTimeout(750);
    expect(outpostRequests).toEqual([]);
    for (const [label, world] of [
        ["Moon", "moon"],
        ["Mars", "mars"],
    ] as const) {
        await page.getByRole("button", { name: label, exact: true }).click();
        await expect(stage).toHaveAttribute("data-world", world, {
            timeout: 30000,
        });
        await expect(stage).toHaveAttribute("data-view", "surface", {
            timeout: 30000,
        });
        await expect(stage).toHaveAttribute("data-settlement-attached", "true");
        const anchor = await stage.getAttribute("data-surface-anchor");
        const coordinates = anchor?.split(",").map(Number) ?? [];
        expect(coordinates).toHaveLength(3);
        expect(coordinates.every(Number.isFinite)).toBe(true);
        expect(
            outpostRequests.some((url) =>
                new RegExp(`/models/${world}-outpost(-lite)?-v3\\.glb`).test(
                    url,
                ),
            ),
        ).toBe(true);
    }
});

test("Moon settlement stays attached during a continuous surface descent", async ({
    page,
}) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.addInitScript(() =>
        Object.defineProperty(navigator, "deviceMemory", {
            configurable: true,
            value: 4,
        }),
    );
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/resume");
    const supported = await page.evaluate(() =>
        Boolean(document.createElement("canvas").getContext("webgl2")),
    );
    test.skip(!supported, "WebGL2 is unavailable in this browser");
    const stage = page.locator("[data-experience-stage]");
    await expect(stage.locator("canvas")).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: "Moon", exact: true }).click();
    await expect(stage).toHaveAttribute("data-world", "moon", {
        timeout: 30000,
    });
    await expect(stage).toHaveAttribute("data-settlement-attached", "true", {
        timeout: 30000,
    });
    await expect
        .poll(
            async () =>
                Number(await stage.getAttribute("data-surface-progress")),
            { timeout: 30000 },
        )
        .toBeGreaterThan(0.05);
    const intermediate = Number(
        await stage.getAttribute("data-surface-progress"),
    );
    expect(intermediate).toBeLessThan(0.98);
    await expect
        .poll(
            async () =>
                Number(await stage.getAttribute("data-surface-progress")),
            { timeout: 60000 },
        )
        .toBeGreaterThan(0.98);
    await expect(stage).toHaveAttribute("data-view", "surface");
    await expect(stage).toHaveAttribute("data-settlement-attached", "true");
});

test("manual surface camera stays put until guided view is restored", async ({
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
        timeout: 30000,
    });
    await expect(stage).toHaveAttribute("data-view", "surface", {
        timeout: 30000,
    });
    const before = await stage.getAttribute("data-camera");
    await stage.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(stage).toHaveAttribute("data-navigation", "manual");
    await expect.poll(() => stage.getAttribute("data-camera")).not.toBe(before);
    const manual = await stage.getAttribute("data-camera");
    await page.waitForTimeout(750);
    expect(await stage.getAttribute("data-camera")).toBe(manual);
    await page.getByRole("button", { name: "Replay the guided tour" }).click();
    await expect(stage).toHaveAttribute("data-navigation", "guided");
});

test("the Moon globe remains usable when its optional surface model fails", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/models/moon-outpost*-v3.glb", (route) =>
        route.abort(),
    );
    await page.goto("/resume");
    const supported = await page.evaluate(() =>
        Boolean(document.createElement("canvas").getContext("webgl2")),
    );
    test.skip(!supported, "WebGL2 is unavailable in this browser");
    const stage = page.locator("[data-experience-stage]");
    await expect(stage.locator("canvas")).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: "Moon", exact: true }).click();
    await expect(stage).toHaveAttribute("data-world", "moon", {
        timeout: 30000,
    });
    await expect(stage).toHaveAttribute("data-view", "orbit");
    await expect(stage.locator("canvas")).toBeVisible();
    await expect(page.locator("#cv")).toBeVisible();
});

test("experience chapter links reach the record and scrolling over the scene moves the page", async ({
    page,
}) => {
    test.setTimeout(90000);
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
        .poll(() => page.evaluate(() => window.scrollY), { timeout: 20000 })
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

test("mobile experience supports touch exploration and restores reading scroll on exit", async ({
    browser,
}) => {
    test.setTimeout(120000);
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
        reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto("/resume");
    const visual = page.locator(".experience-visual");
    const viewport = visual.locator(".observatory__viewport");
    const expand = page.locator("[data-scene-camera-toggle]");
    const stage = page.locator("[data-experience-stage]");
    await expect(stage.locator("canvas")).toBeVisible({ timeout: 20000 });
    await expect(visual).toHaveAttribute("data-layout", "arrival");
    const initialHeight = (await viewport.boundingBox())!.height;
    await page.evaluate(() => {
        const grid = document.querySelector<HTMLElement>(".trajectory-grid")!;
        window.scrollTo({
            top: grid.getBoundingClientRect().top + scrollY + 120,
            behavior: "instant",
        });
    });
    await expect(visual).toHaveAttribute("data-layout", "compact");
    const compactHeight = (await viewport.boundingBox())!.height;
    expect(compactHeight).toBeLessThan(initialHeight);
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    await expand.click();
    await expect(visual).toHaveAttribute("data-layout", "expanded");
    await expect(expand).toHaveAttribute("aria-expanded", "true");
    await expect(expand).toHaveText("Done");
    expect((await viewport.boundingBox())!.height).toBeGreaterThan(
        compactHeight,
    );
    const session = await context.newCDPSession(page);
    const scene = (await stage.boundingBox())!;
    const x = scene.x + scene.width / 2;
    const y = scene.y + scene.height / 2;
    const beforeOrbit = await stage.getAttribute("data-camera");
    const beforeTouchScroll = await page.evaluate(() => scrollY);
    await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
    });
    await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + 60, y: y + 12 }],
    });
    await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
    });
    await expect
        .poll(() => stage.getAttribute("data-camera"))
        .not.toBe(beforeOrbit);
    const beforePinch = Number(await stage.getAttribute("data-distance"));
    const beforePan = await stage.getAttribute("data-camera-target");
    await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
            { id: 0, x: x - 30, y },
            { id: 1, x: x + 30, y },
        ],
    });
    await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
            { id: 0, x: x - 40, y: y + 30 },
            { id: 1, x: x + 50, y: y + 30 },
        ],
    });
    await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
    });
    await expect
        .poll(async () => Number(await stage.getAttribute("data-distance")))
        .toBeLessThan(beforePinch);
    await expect
        .poll(() => stage.getAttribute("data-camera-target"))
        .not.toBe(beforePan);
    expect(await page.evaluate(() => scrollY)).toBe(beforeTouchScroll);
    await page.getByRole("button", { name: "Moon", exact: true }).click();
    await expect(stage).toHaveAttribute("data-world", "moon", {
        timeout: 30000,
    });
    await page.evaluate(() =>
        window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: "instant",
        }),
    );
    await expect(visual).toHaveAttribute("data-layout", "expanded");
    await page.waitForTimeout(750);
    await expect(stage).toHaveAttribute("data-world", "moon");
    await page.evaluate(() => {
        const grid = document.querySelector<HTMLElement>(".trajectory-grid")!;
        window.scrollTo({
            top: grid.getBoundingClientRect().top + scrollY + 120,
            behavior: "instant",
        });
    });
    await expect(stage).toHaveAttribute("data-world", "moon");
    await page.keyboard.press("Escape");
    await expect(visual).toHaveAttribute("data-layout", "compact");
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    await expect(expand).toBeFocused();
    const bounds = await viewport.boundingBox();
    expect(bounds).not.toBeNull();
    const touchX = bounds!.x + bounds!.width / 2;
    const touchY = bounds!.y + bounds!.height * 0.8;
    const before = await page.evaluate(() => scrollY);
    await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: touchX, y: touchY }],
    });
    for (const offset of [20, 40, 60, 80])
        await session.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: touchX, y: touchY - offset }],
        });
    await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
    });
    await expect
        .poll(() => page.evaluate(() => scrollY), { timeout: 20000 })
        .toBeGreaterThan(before);
    await context.close();
});

test("mobile Moon selection reaches the surface through compact resizing", async ({
    page,
}) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/resume");
    const supported = await page.evaluate(() =>
        Boolean(document.createElement("canvas").getContext("webgl2")),
    );
    test.skip(!supported, "WebGL2 is unavailable in this browser");
    const stage = page.locator("[data-experience-stage]");
    await expect(stage.locator("canvas")).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: "Moon", exact: true }).click();
    await expect(page.locator(".experience-visual")).toHaveAttribute(
        "data-layout",
        "compact",
        { timeout: 30000 },
    );
    await expect(stage).toHaveAttribute("data-world", "moon", {
        timeout: 30000,
    });
    await expect(stage).toHaveAttribute("data-view", "surface", {
        timeout: 120000,
    });
    await expect(stage).toHaveAttribute("data-settlement-attached", "true");
    const nearPlane = Number(await stage.getAttribute("data-near-plane"));
    expect(nearPlane).toBeGreaterThan(0);
    expect(nearPlane).toBeLessThan(0.01);
});

test("Studio deep links serve the standalone shell", async ({ request }) => {
    const response = await request.get("/studio/structure/post");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/html");
    expect(await response.text()).toContain("/studio/static/");
});

test("public pages have no serious accessibility violations in either theme", async ({
    page,
}) => {
    test.setTimeout(120000);
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    for (const path of [
        "/",
        "/portfolio",
        "/blog",
        "/blog/fixture-post-code-and-links",
        "/about",
        "/contact",
    ]) {
        await page.goto(path);
        for (const theme of ["light", "dark"]) {
            await page.locator("html").evaluate((element, value) => {
                element.dataset.theme = value;
            }, theme);
            const results = await new AxeBuilder({ page }).analyze();
            expect(
                results.violations.filter(
                    (v) => v.impact === "critical" || v.impact === "serious",
                ),
                `${path} ${theme}`,
            ).toEqual([]);
        }
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
        // The page-wide sky: the 2k file, or the 1k file up to 800 CSS px.
        if (
            [
                "/images/trajectory/milky-way-v2-2k.webp",
                "/images/trajectory/milky-way-v2-1k.webp",
            ].includes(new URL(url).pathname)
        )
            return;
        if (
            /\/images\/trajectory\/|\/terrain\/|\/models\/nasa-perseverance\.glb|\/three\/draco\/|\/three\.module\.|\/GLTFLoader\.|\/DRACOLoader\.|\/OrbitControls\.|\/ExperienceVisual\.|\/HeroVisual\.|\/SpaceStudy\.|\/space-studies\./i.test(
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

test("lunar launch moves and completes a loop", async ({ page }) => {
    test.setTimeout(600000);
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.addInitScript(() =>
        Object.defineProperty(navigator, "deviceMemory", {
            configurable: true,
            value: 4,
        }),
    );
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/resume");
    const supported = await page.evaluate(() =>
        Boolean(document.createElement("canvas").getContext("webgl2")),
    );
    test.skip(!supported, "WebGL2 is unavailable in this browser");
    const stage = page.locator("[data-experience-stage]");
    await expect(stage.locator("canvas")).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: "Moon", exact: true }).click();
    await expect(stage).toHaveAttribute("data-world", "moon", {
        timeout: 30000,
    });
    await expect(stage).toHaveAttribute("data-view", "surface", {
        timeout: 90000,
    });
    await expect(stage).toHaveAttribute("data-launch-state", "running", {
        timeout: 90000,
    });
    const initialCycle = Number(await stage.getAttribute("data-launch-cycle"));
    await expect(stage).toHaveAttribute("data-launch-phase", "accelerating", {
        timeout: 60000,
    });
    const firstPosition = await stage.getAttribute("data-launch-position");
    await expect
        .poll(() => stage.getAttribute("data-launch-position"), {
            timeout: 30000,
        })
        .not.toBe(firstPosition);
    await expect
        .poll(
            async () => Number(await stage.getAttribute("data-launch-cycle")),
            { timeout: 400000 },
        )
        .toBeGreaterThan(initialCycle);
});

test("lunar playback replays exactly and freezes for pause, reduced motion and departure", async ({
    page,
}) => {
    test.setTimeout(300000);
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.addInitScript(() =>
        Object.defineProperty(navigator, "deviceMemory", {
            configurable: true,
            value: 4,
        }),
    );
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/resume");
    const supported = await page.evaluate(() =>
        Boolean(document.createElement("canvas").getContext("webgl2")),
    );
    test.skip(!supported, "WebGL2 is unavailable in this browser");
    const stage = page.locator("[data-experience-stage]");
    await expect(stage.locator("canvas")).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: "Moon", exact: true }).click();
    await expect(stage).toHaveAttribute("data-world", "moon", {
        timeout: 30000,
    });
    await expect(stage).toHaveAttribute("data-view", "surface", {
        timeout: 90000,
    });
    await expect(stage).toHaveAttribute("data-launch-state", "running", {
        timeout: 90000,
    });
    await stage.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(stage).toHaveAttribute("data-navigation", "manual");
    const guided = Number(await stage.getAttribute("data-guided-time"));
    const journey = Number(await stage.getAttribute("data-journey-time"));
    await expect
        .poll(
            async () => Number(await stage.getAttribute("data-journey-time")),
            { timeout: 30000 },
        )
        .toBeGreaterThan(journey);
    expect(Number(await stage.getAttribute("data-guided-time"))).toBe(guided);
    await page.getByRole("button", { name: "Pause motion" }).click();
    await expect(stage).toHaveAttribute("data-launch-state", "paused");
    const preReplayJourney = Number(
        await stage.getAttribute("data-journey-time"),
    );
    const boundary = Math.ceil(preReplayJourney / 36) * 36;
    await page.getByRole("button", { name: "Replay the guided tour" }).click();
    await expect(stage).toHaveAttribute("data-navigation", "guided");
    await expect
        .poll(() =>
            stage.evaluate((element) => ({
                journey: Number(element.getAttribute("data-journey-time")),
                guided: Number(element.getAttribute("data-guided-time")),
            })),
        )
        .toEqual({ journey: boundary, guided: boundary });
    expect(boundary % 36).toBe(0);
    const pausedPosition = await stage.getAttribute("data-launch-position");
    const pausedCycle = await stage.getAttribute("data-launch-cycle");
    await page.waitForTimeout(1200);
    expect(await stage.getAttribute("data-launch-position")).toBe(
        pausedPosition,
    );
    expect(await stage.getAttribute("data-launch-cycle")).toBe(pausedCycle);

    await page.getByRole("button", { name: "Resume motion" }).click();
    await expect(stage).toHaveAttribute("data-launch-state", "running");
    await expect
        .poll(() => stage.getAttribute("data-launch-position"), {
            timeout: 90000,
        })
        .not.toBe(pausedPosition);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(
        page.getByRole("button", { name: "Motion reduced by system" }),
    ).toBeDisabled();
    await expect(stage).toHaveAttribute("data-launch-state", "paused");
    const reducedPosition = await stage.getAttribute("data-launch-position");
    const reducedCycle = await stage.getAttribute("data-launch-cycle");
    await page.waitForTimeout(1200);
    expect(await stage.getAttribute("data-launch-position")).toBe(
        reducedPosition,
    );
    expect(await stage.getAttribute("data-launch-cycle")).toBe(reducedCycle);
    await page.getByRole("button", { name: "Mars", exact: true }).click();
    await expect(stage).toHaveAttribute("data-world", "mars", {
        timeout: 30000,
    });
    await expect(stage).toHaveAttribute("data-launch-state", "inactive");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForTimeout(1200);
    expect(await stage.getAttribute("data-launch-position")).toBe(
        reducedPosition,
    );
    expect(await stage.getAttribute("data-launch-cycle")).toBe(reducedCycle);
});
