"use client";

import { useLayoutEffect } from "react";
import { THEME_MOTION_BOOT } from "@/lib/theme-boot";

/**
 * The boot script's second chance. When a dynamic route calls `notFound()`
 * during its first render (an unknown post or project slug), Next.js
 * answers with a recovery document that only JavaScript fills: React
 * renders the head's boot script into it, and a script React inserts
 * never runs, so the stored theme, `data-motion` and `data-js` (which
 * shows the theme and motion controls) would be missing. Then this runs
 * the same script once, before that render paints. On every other page
 * the script has already run from the head and this does nothing.
 */
export default function ThemeBootFallback() {
    useLayoutEffect(() => {
        if (document.documentElement.dataset.js !== undefined) return;
        // A script element created in script runs when inserted (CSP:
        // `script-src 'unsafe-inline'`, as for the head's copy).
        const script = document.createElement("script");
        script.textContent = THEME_MOTION_BOOT;
        document.head.append(script);
        script.remove();
    }, []);
    return null;
}
