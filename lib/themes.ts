/**
 * Accent themes registered for the theme selector. Each theme corresponds
 * to a [data-theme="…"] block in app/globals.css that defines the
 * --c1 / --c2 / --c3 (accent), --c1/2/3-text (AA-safe light-mode text),
 * and --mesh-a / --mesh-b (background mesh) RGB triplets.
 *
 * To add a theme:
 *   1. Add a new [data-theme="x"] block in globals.css with the tokens
 *      (including the 700-series --c*-text triplets for light mode)
 *   2. Append a Theme entry here with a swatch for the selector preview
 *
 * The no-FOUC script in app/layout.tsx derives its valid-theme list from
 * this array — no third copy to maintain.
 */

export type ThemeId = "glass" | "aurora" | "sunset" | "plum";

export const DEFAULT_THEME: ThemeId = "aurora";

export interface Theme {
    id: ThemeId;
    label: string;
    description: string;
    /** Three swatch colors shown as a preview chip in the selector. */
    swatch: [string, string, string];
}

export const themes: Theme[] = [
    {
        id: "aurora",
        label: "Aurora",
        description: "Emerald, teal, and cyan.",
        swatch: ["#10b981", "#14b8a6", "#22d3ee"],
    },
    {
        id: "glass",
        label: "Surface Glass",
        description: "Cool indigo, violet, and sky.",
        swatch: ["#6366f1", "#a78bfa", "#38bdf8"],
    },
    {
        id: "sunset",
        label: "Sunset",
        description: "Orange, rose, and amber.",
        swatch: ["#ea580c", "#f43f5e", "#f59e0b"],
    },
    {
        id: "plum",
        label: "Plum",
        description: "Fuchsia, violet, and pink.",
        swatch: ["#c026d3", "#7c3aed", "#ec4899"],
    },
];

export function isThemeId(value: unknown): value is ThemeId {
    return typeof value === "string" && themes.some((t) => t.id === value);
}
