import {
    MOTION_KEY,
    PREFERS_LIGHT,
    PREFERS_REDUCED_MOTION,
    THEME_COLORS,
    THEME_KEY,
    normalizeThemePref,
    resolveTheme,
    type MotionPref,
    type Theme,
    type ThemePref,
} from "@/lib/theme-boot";

/**
 * The client store behind the theme and motion controls (plan §2.5.1),
 * read through `useSyncExternalStore`. The boot script (lib/theme-boot.ts)
 * has already applied both preferences before the first paint; this module
 * changes them afterwards and keeps every control and every open tab in
 * step.
 *
 * - The server snapshot is `undefined`, so the controls hydrate with
 *   nothing checked and then check the right option: no hydration mismatch.
 *   Their look comes from CSS on `html[data-theme]`, so nothing flashes.
 * - A change made in another tab arrives as a `storage` event. With `auto`,
 *   an OS colour-scheme change applies at once.
 * - `themechange` and `motionchange` (on `document`) tell canvas and WebGL
 *   islands to redraw.
 */

const EVENT = "ar-prefs";
let memory: { theme?: string; motion?: string } = {};

function read(key: string): string | null {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return key === THEME_KEY
            ? (memory.theme ?? null)
            : (memory.motion ?? null);
    }
}

function write(key: string, value: string) {
    memory = { ...memory, [key === THEME_KEY ? "theme" : "motion"]: value };
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // Private modes: the choice lasts for this page only.
    }
}

function matches(query: string): boolean {
    return typeof window.matchMedia === "function"
        ? window.matchMedia(query).matches
        : false;
}

function setMeta(name: string, content: string) {
    document
        .querySelector(`meta[name="${name}"]`)
        ?.setAttribute("content", content);
}

function applyTheme(theme: Theme, animate: boolean) {
    const root = document.documentElement;
    if (root.dataset.theme === theme) return;
    const swap = () => {
        root.dataset.theme = theme;
        setMeta("color-scheme", theme === "manual" ? "light" : "dark");
        setMeta("theme-color", THEME_COLORS[theme]);
    };
    // A same-document cross-fade, header included; none under reduced
    // motion. html[data-vt="theme"] turns element transitions off meanwhile.
    if (
        animate &&
        typeof document.startViewTransition === "function" &&
        root.dataset.motion === "full" &&
        !root.dataset.vt
    ) {
        root.dataset.vt = "theme";
        const transition = document.startViewTransition(swap);
        transition.finished.finally(() => delete root.dataset.vt);
    } else {
        swap();
    }
    document.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
}

function applyMotion(pref: MotionPref) {
    const motion = matches(PREFERS_REDUCED_MOTION) ? "reduced" : pref;
    document.documentElement.dataset.motion = motion;
    document.dispatchEvent(new CustomEvent("motionchange", { detail: motion }));
}

function notify() {
    window.dispatchEvent(new Event(EVENT));
}

// One set of window listeners, however many controls subscribe.
let listeners = 0;
let stopWatching: (() => void) | null = null;

function watch() {
    const onStorage = (event: StorageEvent) => {
        if (event.key === THEME_KEY) {
            applyTheme(
                resolveTheme(getThemePref(), matches(PREFERS_LIGHT)),
                false,
            );
        } else if (event.key === MOTION_KEY) {
            applyMotion(getMotionPref());
        } else {
            return;
        }
        notify();
    };
    const light = window.matchMedia?.(PREFERS_LIGHT);
    const onScheme = () => {
        if (getThemePref() === "auto") {
            applyTheme(resolveTheme("auto", matches(PREFERS_LIGHT)), true);
        }
    };
    const reduce = window.matchMedia?.(PREFERS_REDUCED_MOTION);
    const onReduce = () => applyMotion(getMotionPref());
    window.addEventListener("storage", onStorage);
    light?.addEventListener("change", onScheme);
    reduce?.addEventListener("change", onReduce);
    return () => {
        window.removeEventListener("storage", onStorage);
        light?.removeEventListener("change", onScheme);
        reduce?.removeEventListener("change", onReduce);
    };
}

/** `useSyncExternalStore` subscribe for both preferences. */
export function subscribePrefs(callback: () => void): () => void {
    window.addEventListener(EVENT, callback);
    if (listeners++ === 0) stopWatching = watch();
    return () => {
        window.removeEventListener(EVENT, callback);
        if (--listeners === 0) {
            stopWatching?.();
            stopWatching = null;
        }
    };
}

export function getThemePref(): ThemePref {
    return normalizeThemePref(read(THEME_KEY));
}

export function setThemePref(pref: ThemePref) {
    write(THEME_KEY, pref);
    applyTheme(resolveTheme(pref, matches(PREFERS_LIGHT)), true);
    notify();
}

export function getMotionPref(): MotionPref {
    return read(MOTION_KEY) === "reduced" ? "reduced" : "full";
}

export function setMotionPref(pref: MotionPref) {
    write(MOTION_KEY, pref);
    applyMotion(pref);
    notify();
}

/** The server has no preference: controls render unchecked until hydrated. */
export function getServerPref(): undefined {
    return undefined;
}
