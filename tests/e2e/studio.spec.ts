import type { Page } from "@playwright/test";
import { expect, test } from "./support/test";
import { stubSanityApi } from "./support/sanity-api";

/**
 * The embedded Studio with JavaScript: its bundle loads, `sanity.config.ts`
 * and the schema compile, and the desk structure resolves. The Studio talks
 * to the Sanity API from the browser, so these run on the fixture build
 * only, against `stubSanityApi`. Console errors are not asserted: with the
 * stand-in API and the Studio's CSP (next.config.mjs), the Studio logs
 * failed telemetry, update-check and presence requests. Uncaught exceptions
 * and Sanity's error screens are.
 */
test.beforeEach(({}, testInfo) => {
    test.skip(
        testInfo.project.name !== "fixture",
        "Needs the stubbed Sanity API of the fixture build",
    );
});

function recordUncaught(page: Page): string[] {
    const uncaught: string[] = [];
    page.on("pageerror", (error) => uncaught.push(error.message));
    return uncaught;
}

async function expectNoStudioErrorScreen(page: Page) {
    await expect(page.getByText(/An error occurred/)).toHaveCount(0);
    await expect(page.getByText(/schema error/i)).toHaveCount(0);
    await expect(page.getByText(/Tool not found/)).toHaveCount(0);
}

test("the Studio boots to its login screen", async ({ page }) => {
    const uncaught = recordUncaught(page);
    await stubSanityApi(page, { signedIn: false });

    await page.goto("/studio");
    await expect(page.getByText("E-mail / password")).toBeVisible({
        timeout: 30_000,
    });
    await expectNoStudioErrorScreen(page);
    expect(uncaught).toEqual([]);
});

test("the signed-in Studio shows the site's structure under /studio", async ({
    page,
}) => {
    const uncaught = recordUncaught(page);
    await stubSanityApi(page, { signedIn: true });

    await page.goto("/studio");
    // basePath "/studio" (sanity.config.ts): the Studio routes its tools
    // below the Next.js route instead of reading "studio" as a tool name.
    await expect(page).toHaveURL(/\/studio\/structure/, { timeout: 30_000 });
    for (const item of [
        "Profile",
        "Flight Log · Posts",
        "Missions · Projects",
    ]) {
        await expect(page.getByRole("link", { name: item })).toBeVisible();
    }

    await page.getByRole("link", { name: "Flight Log · Posts" }).click();
    await expect(page.getByRole("link", { name: "All Posts" })).toBeVisible();
    await page.getByRole("link", { name: "Scheduled" }).click();
    await expect(page).toHaveURL(/scheduled-posts/);

    await page.getByRole("link", { name: "Missions · Projects" }).click();
    await expect(page).toHaveURL(/\/studio\/structure\/project/);

    // A new project's form renders every group of the schema. (The
    // stand-in API grants no write access, so the fields are read-only; the
    // template's initial values are covered in tests/schema/project.test.ts.)
    await page.goto("/studio/intent/create/template=project;type=project/");
    await expect(
        page.getByRole("heading", { name: "New Project" }),
    ).toBeVisible({ timeout: 30_000 });
    for (const group of [
        "Editorial",
        "Details",
        "Brief & Results",
        "3D Model",
    ]) {
        await expect(page.getByRole("tab", { name: group })).toBeVisible();
    }
    // .first(): the Studio can also list the (empty, required) field in its
    // validation panel, depending on when validation finishes.
    await expect(
        page.getByText("Mission Number", { exact: true }).first(),
    ).toBeVisible();

    await expectNoStudioErrorScreen(page);
    expect(uncaught).toEqual([]);
});
