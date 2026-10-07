import { afterEach, describe, expect, it, vi } from "vitest";
import {
    applyRouteTheme,
    getMotionPref,
    getThemePref,
    setThemePref,
} from "@/lib/prefs";
import { PREFERS_LIGHT, THEME_COLORS } from "@/lib/theme-boot";

/**
 * A stub window and document for lib/prefs.ts: `stored` is localStorage
 * (or one that throws), `light` the OS colour scheme, `path` the page's
 * address and `theme` the one the page shows now. Returns <html>'s
 * dataset, the meta tags' contents and the events dispatched.
 */
function browser({
    stored = {},
    storageThrows = false,
    light = false,
    path = "/",
    theme = "void",
}: {
    stored?: Record<string, string>;
    storageThrows?: boolean;
    light?: boolean;
    path?: string;
    theme?: string;
} = {}) {
    const dataset: Record<string, string> = { theme, motion: "full" };
    const meta: Record<string, string> = {};
    const events: string[] = [];
    const dispatchEvent = (event: Event) => {
        events.push(event.type);
        return true;
    };
    vi.stubGlobal("window", {
        get localStorage() {
            if (storageThrows) throw new Error("SecurityError");
            return {
                getItem: (key: string) => stored[key] ?? null,
                setItem: (key: string, value: string) => {
                    stored[key] = value;
                },
            };
        },
        matchMedia: (query: string) => ({
            matches: light && query === PREFERS_LIGHT,
        }),
        location: { pathname: path },
        dispatchEvent,
    });
    vi.stubGlobal("document", {
        documentElement: { dataset },
        querySelector: (selector: string) => ({
            setAttribute: (_: string, value: string) => {
                meta[/name="([^"]+)"/.exec(selector)![1]] = value;
            },
        }),
        dispatchEvent,
    });
    return { dataset, meta, events, stored };
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("applyRouteTheme", () => {
    it("lets a post follow the OS while nothing is stored", () => {
        const light = browser({ light: true });
        applyRouteTheme("/blog/a-post");
        expect(light.dataset.theme).toBe("manual");
        expect(light.meta).toEqual({
            "color-scheme": "light",
            "theme-color": THEME_COLORS.manual,
        });
        expect(light.events).toEqual(["themechange", "ar-prefs"]);

        const dark = browser();
        applyRouteTheme("/blog/a-post");
        expect(dark.dataset.theme).toBe("void");
    });

    it("keeps every other page Void while nothing is stored, whatever the OS", () => {
        for (const path of [
            "/",
            "/blog",
            "/blog/tags/robotics",
            "/portfolio/homelab",
        ]) {
            // Arriving from a post that a light OS showed in Flight Manual.
            const page = browser({ light: true, theme: "manual" });
            applyRouteTheme(path);
            expect(page.dataset.theme, path).toBe("void");
            expect(page.meta["color-scheme"], path).toBe("dark");
        }
    });

    it("lets a stored choice win on every path", () => {
        const onPost = browser({ stored: { "ar-theme": "void" }, light: true });
        applyRouteTheme("/blog/a-post");
        expect(onPost.dataset.theme).toBe("void");

        const manual = browser({ stored: { "ar-theme": "manual" } });
        applyRouteTheme("/about");
        expect(manual.dataset.theme).toBe("manual");

        const auto = browser({ stored: { "ar-theme": "auto" }, light: true });
        applyRouteTheme("/about");
        expect(auto.dataset.theme).toBe("manual");
    });

    it("changes nothing when the path's theme is already shown, but still notifies", () => {
        const page = browser({ path: "/about" });
        applyRouteTheme("/about");
        expect(page.dataset.theme).toBe("void");
        expect(page.meta).toEqual({});
        expect(page.events).toEqual(["ar-prefs"]);
    });

    it("falls back to the path's default when storage throws", () => {
        const page = browser({ storageThrows: true, light: true });
        applyRouteTheme("/blog/a-post");
        expect(page.dataset.theme).toBe("manual");
    });
});

describe("the preferences in force", () => {
    it("reads the theme as the menu shows it: System on a post, Dark elsewhere, until one is stored", () => {
        browser({ path: "/blog/a-post" });
        expect(getThemePref()).toBe("auto");
        browser({ path: "/about" });
        expect(getThemePref()).toBe("void");
        browser({ path: "/blog/a-post", stored: { "ar-theme": "manual" } });
        expect(getThemePref()).toBe("manual");
    });

    it("stores a chosen theme and shows it at once", () => {
        const page = browser({ path: "/about" });
        setThemePref("manual");
        expect(page.stored["ar-theme"]).toBe("manual");
        expect(page.dataset.theme).toBe("manual");
    });

    it("reads motion as full unless reduced is stored", () => {
        browser();
        expect(getMotionPref()).toBe("full");
        browser({ stored: { "ar-motion": "reduced" } });
        expect(getMotionPref()).toBe("reduced");
    });
});
