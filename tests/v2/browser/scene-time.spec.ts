import { expect, test } from "@playwright/test";

test.describe("local-time Earth lighting", () => {
    test.use({ timezoneId: "America/Los_Angeles" });

    test("uses the visitor's local time and refreshes across phase boundaries", async ({
        page,
    }) => {
        // In January Los Angeles is UTC-8; the browser clock remains running.
        await page.clock.setFixedTime(new Date("2026-01-15T14:00:00Z"));
        await page.goto("/resume");
        const supported = await page.evaluate(() =>
            Boolean(document.createElement("canvas").getContext("webgl2")),
        );
        test.skip(!supported, "WebGL2 is unavailable in this browser");
        const stage = page.locator("[data-experience-stage]");
        const lighting = page.locator("[data-experience-lighting]");
        await expect(stage.locator("canvas")).toBeVisible({ timeout: 20000 });
        await expect(stage).toHaveAttribute("data-world", "earth");
        await expect(stage).toHaveAttribute("data-phase", "dawn");
        await expect(lighting).toHaveText("Dawn · your local time");

        for (const [time, phase, label] of [
            ["2026-01-15T16:59:00Z", "dawn", "Dawn"],
            ["2026-01-15T17:00:00Z", "day", "Day"],
            ["2026-01-16T01:00:00Z", "dusk", "Dusk"],
            ["2026-01-16T04:00:00Z", "night", "Night"],
        ] as const) {
            await page.clock.setFixedTime(new Date(time));
            // A returning tab refreshes without requiring a page reload.
            await page.evaluate(() =>
                document.dispatchEvent(new Event("visibilitychange")),
            );
            await expect(stage).toHaveAttribute("data-phase", phase, {
                timeout: 10000,
            });
            await expect(lighting).toHaveText(`${label} · your local time`);
        }
    });

    test("home initializes the local clock before visiting the experience", async ({
        page,
    }) => {
        await page.clock.setFixedTime(new Date("2026-01-16T01:00:00Z"));
        await page.goto("/");
        const root = page.locator("html");
        await expect(root).toHaveAttribute("data-scene-clock", "ready");
        await expect(root).toHaveAttribute(
            "data-scene-timezone",
            "America/Los_Angeles",
        );
        await expect(root).toHaveAttribute("data-scene-phase", "dusk");
        await page.getByRole("link", { name: "Enter orbit" }).click();
        await expect(root).toHaveAttribute("data-scene-phase", "dusk");
        const poster = page.locator("[data-experience-poster]");
        const stage = page.locator("[data-experience-stage]");
        await expect(poster).toHaveAttribute("data-phase", "dusk");
        await expect(stage).toHaveAttribute("data-ready", "true", {
            timeout: 30000,
        });
        await expect(stage).toHaveAttribute("data-first-frame-phase", "dusk");
        await expect(stage).toHaveAttribute("data-phase", "dusk");
        await expect(stage).toHaveAttribute("data-near-plane", "0.050000");
    });

    test("local clock initialization works when session storage is blocked", async ({
        page,
    }) => {
        await page.clock.setFixedTime(new Date("2026-01-16T01:00:00Z"));
        await page.addInitScript(() => {
            Object.defineProperty(window, "sessionStorage", {
                configurable: true,
                get() {
                    throw new DOMException("Blocked", "SecurityError");
                },
            });
        });
        await page.goto("/");
        await expect(page.locator("html")).toHaveAttribute(
            "data-scene-clock",
            "ready",
        );
        await expect(page.locator("html")).toHaveAttribute(
            "data-scene-phase",
            "dusk",
        );
        await page.getByRole("link", { name: "Enter orbit" }).click();
        await expect(page.locator("[data-experience-stage]")).toHaveAttribute(
            "data-phase",
            "dusk",
            { timeout: 30000 },
        );
    });

    test("retains the local phase after graphics recovery under reduced motion", async ({
        page,
    }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.clock.setFixedTime(new Date("2026-01-16T01:00:00Z"));
        await page.goto("/resume");
        const supported = await page.evaluate(() =>
            Boolean(document.createElement("canvas").getContext("webgl2")),
        );
        test.skip(!supported, "WebGL2 is unavailable in this browser");
        const stage = page.locator("[data-experience-stage]");
        const canvas = stage.locator("canvas");
        await expect(canvas).toBeVisible({ timeout: 20000 });
        await expect(stage).toHaveAttribute("data-phase", "dusk");
        await expect(stage).toHaveAttribute("data-state", "paused");
        const canLoseContext = await canvas.evaluate((element) => {
            const extension = (element as HTMLCanvasElement)
                .getContext("webgl2")
                ?.getExtension("WEBGL_lose_context");
            extension?.loseContext();
            return Boolean(extension);
        });
        test.skip(
            !canLoseContext,
            "WEBGL_lose_context is unavailable in this browser",
        );
        await expect(page.locator("[data-experience-poster]")).toBeVisible();
        await page.getByRole("button", { name: "Try again" }).click();
        await expect(stage.locator("canvas")).toBeVisible({ timeout: 20000 });
        await expect(stage).toHaveAttribute("data-phase", "dusk");
        await expect(page.locator("[data-experience-lighting]")).toHaveText(
            "Dusk · your local time",
        );
    });
});
