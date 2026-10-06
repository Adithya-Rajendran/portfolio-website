/**
 * Theme and motion before the first paint (plan §2.5.1). Keep this module
 * free of imports: the root layouts inline THEME_MOTION_BOOT, and the unit
 * test runs it against a stub document.
 *
 * - `ar-theme` holds `void` | `manual` | `auto`, the visitor's choice,
 *   which always wins. With none (missing or unknown), a post
 *   (`/blog/<slug>`, `POST_PATH`) follows the OS, so a light system reads
 *   it in Flight Manual (premium D3), and every other page is Void. `auto`
 *   follows the OS everywhere (the toggle's third option). A stored
 *   `flight-manual` (the mockups' key value) means `manual`.
 * - `ar-motion` holds `full` | `reduced` (Pause motion). The OS setting can
 *   only reduce motion, never override it.
 *
 * localStorage only, never a cookie: a cookie read on the server would make
 * every route request-bound. The server renders `data-theme="void"` and no
 * `data-motion`, so without JavaScript there is no spatial motion.
 */

export const THEME_KEY = "ar-theme";
export const MOTION_KEY = "ar-motion";

export type Theme = "void" | "manual";
export type ThemePref = Theme | "auto";
export type MotionPref = "full" | "reduced";

/** Page background per theme, for `theme-color` and the manifest. */
export const THEME_COLORS: Record<Theme, string> = {
    void: "#050507",
    manual: "#F2EDE3",
};

export const PREFERS_LIGHT = "(prefers-color-scheme:light)";
export const PREFERS_REDUCED_MOTION = "(prefers-reduced-motion:reduce)";

/** A post's path: with no theme chosen, it follows the OS. Not /blog or a
 *  tag page. */
const POST_PATH = /^\/blog\/[^/]+$/;

/**
 * The preference in force on a path: the stored choice, else the site's
 * default there (`auto` on a post, Void elsewhere). An unknown stored
 * value is no choice.
 */
export function themePref(
    stored: string | null | undefined,
    path: string,
): ThemePref {
    if (stored === "manual" || stored === "flight-manual") return "manual";
    if (stored === "auto" || stored === "void") return stored;
    return POST_PATH.test(path) ? "auto" : "void";
}

/** The theme a preference shows, given the OS colour scheme. */
export function resolveTheme(pref: ThemePref, prefersLight: boolean): Theme {
    if (pref === "auto") return prefersLight ? "manual" : "void";
    return pref;
}

/**
 * The inline boot script, run synchronously in <head> before <body> is
 * parsed. It reads both keys inside `try` (storage can throw in private
 * modes), resolves `auto` and a post with no choice (`themePref`, inlined),
 * applies the reduced-motion setting, sets
 * `data-theme`, `data-motion` and `data-js` on <html>, and adds the
 * `color-scheme` and `theme-color` meta tags. It adds them, rather than
 * updating tags React rendered: React 19 matches a hoisted <meta> by its
 * attributes, so after the script changed one it would insert a second.
 * Kept under 700 bytes (tests/lib/theme-boot.test.ts).
 */
export const THEME_MOTION_BOOT = `(function(d,w){var r=d.documentElement.dataset,s,m="full",t="void",q=function(x){return w.matchMedia(x).matches},g=function(n,v){var e=d.createElement("meta");e.name=n;e.content=v;d.head.append(e)};try{var L=w.localStorage;s=L.getItem("${THEME_KEY}");if(L.getItem("${MOTION_KEY}")=="reduced")m="reduced"}catch(e){}if(s=="manual"||s=="flight-manual"||(s=="auto"||s!="void"&&${POST_PATH}.test(w.location.pathname))&&q("${PREFERS_LIGHT}"))t="manual";if(q("${PREFERS_REDUCED_MOTION}"))m="reduced";r.theme=t;r.motion=m;r.js="";g("color-scheme",t=="manual"?"light":"dark");g("theme-color",t=="manual"?"${THEME_COLORS.manual}":"${THEME_COLORS.void}")})(document,window)`;
