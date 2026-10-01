import { describe, expect, it } from "vitest";
import { THEME_MOTION_BOOT, resolveTheme, themePref } from "@/lib/theme-boot";

interface Stub {
    dataset: Record<string, string>;
    meta: Record<string, string>;
}

/**
 * Runs the boot script against a stub document and window: `stored` is
 * localStorage (or a throwing one), `media` the queries that match, `path`
 * the page's address.
 */
function boot({
    stored = {},
    media = [],
    storageThrows = false,
    path = "/",
}: {
    stored?: Record<string, string>;
    media?: string[];
    storageThrows?: boolean;
    path?: string;
} = {}): Stub {
    const stub: Stub = { dataset: {}, meta: {} };
    const document = {
        documentElement: { dataset: stub.dataset },
        createElement: () => ({ name: "", content: "" }),
        head: {
            append(element: { name: string; content: string }) {
                expect(stub.meta[element.name]).toBeUndefined();
                stub.meta[element.name] = element.content;
            },
        },
    };
    const window = {
        get localStorage() {
            if (storageThrows) throw new Error("SecurityError");
            return { getItem: (key: string) => stored[key] ?? null };
        },
        matchMedia: (query: string) => ({ matches: media.includes(query) }),
        location: { pathname: path },
    };
    new Function("document", "window", THEME_MOTION_BOOT)(document, window);
    return stub;
}

const LIGHT = "(prefers-color-scheme:light)";
const REDUCE = "(prefers-reduced-motion:reduce)";

describe("the theme boot script", () => {
    it("stays under 700 bytes", () => {
        // 661 with the post rule (premium D3), from 590.
        expect(new TextEncoder().encode(THEME_MOTION_BOOT).length).toBeLessThan(
            700,
        );
    });

    it("shows Void to a first-time visitor, even with a light OS, off the posts", () => {
        for (const path of [
            "/",
            "/blog",
            "/blog/archive",
            "/blog/tags/gpu",
            "/portfolio/homelab",
            "/resume",
        ]) {
            const { dataset, meta } = boot({ media: [LIGHT], path });
            expect(dataset, path).toEqual({
                theme: "void",
                motion: "full",
                js: "",
            });
            expect(meta, path).toEqual({
                "color-scheme": "dark",
                "theme-color": "#050507",
            });
        }
    });

    it("lets a post follow the OS until a theme is chosen", () => {
        const post = "/blog/my-homelab";
        const light = boot({ media: [LIGHT], path: post });
        expect(light.dataset.theme).toBe("manual");
        expect(light.meta).toEqual({
            "color-scheme": "light",
            "theme-color": "#F2EDE3",
        });
        expect(boot({ path: post }).dataset.theme).toBe("void");
        // An unknown value is no choice; a stored choice always wins.
        expect(
            boot({
                stored: { "ar-theme": "sepia" },
                media: [LIGHT],
                path: post,
            }).dataset.theme,
        ).toBe("manual");
        expect(
            boot({ stored: { "ar-theme": "void" }, media: [LIGHT], path: post })
                .dataset.theme,
        ).toBe("void");
        expect(
            boot({ storageThrows: true, media: [LIGHT], path: post }).dataset
                .theme,
        ).toBe("manual");
    });

    it("applies a stored Flight Manual and adds its meta tags", () => {
        const { dataset, meta } = boot({ stored: { "ar-theme": "manual" } });
        expect(dataset.theme).toBe("manual");
        expect(meta).toEqual({
            "color-scheme": "light",
            "theme-color": "#F2EDE3",
        });
    });

    it("reads the mockups' flight-manual value as manual", () => {
        expect(
            boot({ stored: { "ar-theme": "flight-manual" } }).dataset.theme,
        ).toBe("manual");
    });

    it("follows the OS only when the choice is auto", () => {
        const auto = { "ar-theme": "auto" };
        expect(boot({ stored: auto, media: [LIGHT] }).dataset.theme).toBe(
            "manual",
        );
        expect(boot({ stored: auto }).dataset.theme).toBe("void");
    });

    it("treats an unknown stored value as Void", () => {
        expect(boot({ stored: { "ar-theme": "sepia" } }).dataset.theme).toBe(
            "void",
        );
    });

    it("falls back to Void and full motion when storage throws", () => {
        expect(boot({ storageThrows: true }).dataset).toEqual({
            theme: "void",
            motion: "full",
            js: "",
        });
    });

    it("reduces motion for Pause motion or the OS setting", () => {
        expect(
            boot({ stored: { "ar-motion": "reduced" } }).dataset.motion,
        ).toBe("reduced");
        expect(boot({ media: [REDUCE] }).dataset.motion).toBe("reduced");
        // The OS setting can only reduce motion, never override it.
        expect(
            boot({ stored: { "ar-motion": "full" }, media: [REDUCE] }).dataset
                .motion,
        ).toBe("reduced");
    });
});

describe("theme preferences", () => {
    it("reads the stored choice, else the path's default", () => {
        expect(themePref(null, "/")).toBe("void");
        expect(themePref("manual", "/")).toBe("manual");
        expect(themePref("flight-manual", "/")).toBe("manual");
        expect(themePref("auto", "/")).toBe("auto");
        expect(themePref("dark", "/")).toBe("void");
        // A post follows the OS until a theme is chosen.
        expect(themePref(null, "/blog/my-homelab")).toBe("auto");
        expect(themePref("dark", "/blog/my-homelab")).toBe("auto");
        expect(themePref("void", "/blog/my-homelab")).toBe("void");
        expect(themePref("manual", "/blog/my-homelab")).toBe("manual");
        expect(themePref(null, "/blog")).toBe("void");
        expect(themePref(null, "/blog/archive")).toBe("void");
        expect(themePref(null, "/blog/tags/gpu")).toBe("void");
    });

    it("resolves auto from the OS colour scheme", () => {
        expect(resolveTheme("auto", true)).toBe("manual");
        expect(resolveTheme("auto", false)).toBe("void");
        expect(resolveTheme("manual", false)).toBe("manual");
        expect(resolveTheme("void", true)).toBe("void");
    });
});
