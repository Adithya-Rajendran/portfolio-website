import { THEME_MOTION_BOOT } from "@/lib/theme-boot";

/**
 * The inline boot script for the head of every document (the root layout
 * and global-not-found). It runs before <body> is parsed, applies the
 * stored theme and motion preferences (lib/theme-boot.ts) so neither theme
 * flashes, and adds the `color-scheme` and `theme-color` meta tags for the
 * theme it chose. Without JavaScript there are no such tags; the CSS
 * `color-scheme` on :root still sets the page's scheme.
 * CSP: `script-src 'unsafe-inline'` allows it (next.config.mjs).
 */
export default function ThemeBootScript() {
    return <script dangerouslySetInnerHTML={{ __html: THEME_MOTION_BOOT }} />;
}
