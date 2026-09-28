import type { Page } from "@playwright/test";

export const THEMES = ["void", "manual"] as const;
export type SiteTheme = (typeof THEMES)[number];

/**
 * Stores a theme choice before any page loads, as the toggle would
 * (lib/prefs.ts), so the boot script applies it on the first paint.
 */
export async function storeTheme(page: Page, theme: SiteTheme) {
    await page.addInitScript((value) => {
        try {
            window.localStorage.setItem("ar-theme", value);
        } catch {
            // Storage blocked: the page stays Void, which the spec sees.
        }
    }, theme);
}
