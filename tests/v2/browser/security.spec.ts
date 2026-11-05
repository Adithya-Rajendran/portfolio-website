import { expect, test } from "@playwright/test";

test("public CSP permits trusted boot scripts and blocks injected inline code", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => {
        localStorage.setItem("theme", "light");
        (window as any).cspViolations = [];
        document.addEventListener("securitypolicyviolation", (event) => {
            (window as any).cspViolations.push(event.effectiveDirective);
        });
    });
    const response = await page.goto("/about");
    const policy = response!.headers()["content-security-policy"];
    const scripts = policy
        .split("; ")
        .find((part) => part.startsWith("script-src "))!;
    const nonce = scripts.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce).toBeTruthy();
    expect(scripts).not.toContain("'unsafe-inline'");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("html")).toHaveAttribute(
        "data-scene-clock",
        "ready",
    );
    await page.evaluate(() => {
        const script = document.createElement("script");
        script.textContent = "window.injectedScriptRan = true";
        document.body.append(script);
        const button = document.createElement("button");
        button.setAttribute("onclick", "window.injectedHandlerRan = true");
        document.body.append(button);
        button.click();
    });
    await expect
        .poll(() => page.evaluate(() => (window as any).cspViolations.length))
        .toBeGreaterThanOrEqual(2);
    expect(
        await page.evaluate(() => [
            (window as any).injectedScriptRan,
            (window as any).injectedHandlerRan,
        ]),
    ).toEqual([undefined, undefined]);
    const violations = await page.evaluate(
        () => (window as any).cspViolations as string[],
    );
    expect(violations).toContain("script-src-elem");
    expect(violations).toContain("script-src-attr");
    const second = await page.reload();
    const secondPolicy = second!.headers()["content-security-policy"];
    const nextNonce = secondPolicy.match(/'nonce-([^']+)'/)?.[1];
    expect(nextNonce).toBeTruthy();
    expect(nextNonce).not.toBe(nonce);
});

for (const path of [
    "/",
    "/resume",
    "/portfolio",
    "/blog",
    "/about",
    "/contact",
]) {
    test(`public resources comply with CSP on ${path}`, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.addInitScript(() => {
            (window as any).cspViolations = [];
            document.addEventListener("securitypolicyviolation", (event) => {
                (window as any).cspViolations.push(
                    `${event.effectiveDirective}: ${event.blockedURI}`,
                );
            });
        });
        await page.goto(path, { waitUntil: "networkidle" });
        await expect(page.locator("html")).toHaveAttribute(
            "data-scene-clock",
            "ready",
        );
        expect(
            await page.evaluate(() => (window as any).cspViolations),
        ).toEqual([]);
    });
}
