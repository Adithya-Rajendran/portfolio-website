import {
    test as base,
    expect,
    type BrowserContext,
    type Page,
} from "@playwright/test";

/**
 * The shared `test` for every spec. `prepareContext` adapts each browser
 * context to the target before any page loads:
 *
 * - `fixture`: `next start` does not serve the scripts Vercel injects at
 *   `/_vercel/*` (Web Analytics, Speed Insights), so they are answered with
 *   an empty script instead of logging 404s. Every other off-origin request
 *   (the YouTube embed in the project-essay fixture) gets an empty 200, so
 *   the run never leaves the machine.
 * - `preview`: same-origin requests carry the Vercel protection-bypass
 *   secret when one is set, and ask Vercel not to inject its toolbar. The
 *   secret is never sent to another origin. The Web Analytics and Speed
 *   Insights scripts are answered with an empty script here too, so the
 *   test runs (the weekly one is against the production site) never count
 *   as visits.
 *
 * The `request` fixture gets the same headers, and `pageErrors` records
 * console errors, uncaught exceptions and CSP violations.
 */

const VERCEL_SCRIPT = /\/_vercel\/(insights|speed-insights)\/script\.js$/;

/**
 * Headers for requests to the preview origin (Vercel docs: Protection
 * Bypass for Automation; Managing the Vercel Toolbar). The secret rides on
 * every same-origin request, so no bypass cookie (and no extra redirect to
 * set one) is needed.
 */
export function previewHeaders(): Record<string, string> {
    const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    return {
        "x-vercel-skip-toolbar": "1",
        ...(secret ? { "x-vercel-protection-bypass": secret } : {}),
    };
}

export async function prepareContext(
    context: BrowserContext,
    project: string,
    baseURL: string | undefined,
): Promise<void> {
    const origin = new URL(baseURL ?? "http://127.0.0.1").origin;
    if (project === "preview") {
        const headers = previewHeaders();
        await context.route(
            (url) => url.origin === origin,
            (route) =>
                route.continue({
                    headers: { ...route.request().headers(), ...headers },
                }),
        );
    } else {
        await context.route(
            (url) => url.origin !== origin,
            (route) => route.fulfill({ status: 200, body: "" }),
        );
    }
    // Registered last, so it wins over the routes above (Playwright runs
    // the newest matching route first).
    await context.route(VERCEL_SCRIPT, (route) =>
        route.fulfill({
            status: 200,
            contentType: "text/javascript",
            body: "",
        }),
    );
}

export interface PageErrors {
    /**
     * Returns the errors recorded since the previous call: console errors
     * and uncaught exceptions, plus CSP violations in the current document.
     */
    drain(page: Page): Promise<string[]>;
}

type Fixtures = { pageErrors: PageErrors; target: void };

export const test = base.extend<Fixtures>({
    target: [
        async ({ context, baseURL }, provide, testInfo) => {
            await prepareContext(context, testInfo.project.name, baseURL);
            await provide();
        },
        { auto: true },
    ],

    request: async ({ playwright, baseURL }, provide, testInfo) => {
        const request = await playwright.request.newContext({
            baseURL,
            extraHTTPHeaders:
                testInfo.project.name === "preview" ? previewHeaders() : {},
        });
        await provide(request);
        await request.dispose();
    },

    pageErrors: async ({ page }, provide) => {
        const errors: string[] = [];
        page.on("pageerror", (error) =>
            errors.push(`Uncaught: ${error.message}`),
        );
        page.on("console", (message) => {
            if (message.type() !== "error") return;
            // A 404 page's own document status is logged as a failed load;
            // specs assert that status separately.
            const { url } = message.location();
            if (url === page.url() && message.text().includes("404")) return;
            errors.push(`console.error: ${message.text()} (${url})`);
        });
        // Runs before any page script in every document; read after load.
        await page.addInitScript(() => {
            const log: string[] = [];
            Object.defineProperty(window, "__cspViolations", { value: log });
            document.addEventListener("securitypolicyviolation", (event) =>
                log.push(
                    `CSP: ${event.effectiveDirective} blocked ${event.blockedURI || "inline"}`,
                ),
            );
        });
        await provide({
            async drain(target) {
                const csp = await target.evaluate(
                    () =>
                        (window as unknown as { __cspViolations?: string[] })
                            .__cspViolations ?? [],
                );
                return [...errors.splice(0), ...csp];
            },
        });
    },
});

export { expect };
