/**
 * The exceptions tests/lib/design-system.test.ts allows, each with its
 * reason. An entry that excuses nothing fails the test as stale, so this
 * list shrinks with the code it excuses.
 */

/** One excused declaration, matched exactly: the file, the at-rule chain
 *  ('' at the top level; `@layer` is left out), the selector and the
 *  property as postcss reads them (whitespace collapsed), and the value. */
interface Allowance {
    file: string;
    context: string;
    selector: string;
    property: string;
    value: string;
    reason: string;
}

export const ALLOWANCES: readonly Allowance[] = [
    {
        file: "styles/prose.css",
        context: "@keyframes listing-fade",
        selector: "0%",
        property: "--listing-fade-end",
        value: "2.5rem",
        reason: "A listing's edge fade: the depth its scroll animates the registered length (@property) to.",
    },
    {
        file: "styles/prose.css",
        context: "@keyframes listing-fade",
        selector: "8%",
        property: "--listing-fade-start",
        value: "2.5rem",
        reason: "A listing's edge fade: the depth its scroll animates the registered length (@property) to.",
    },
    {
        file: "styles/prose.css",
        context: "@keyframes listing-fade",
        selector: "92%",
        property: "--listing-fade-end",
        value: "2.5rem",
        reason: "A listing's edge fade: the depth its scroll animates the registered length (@property) to.",
    },
    {
        file: "styles/prose.css",
        context: "@keyframes listing-fade",
        selector: "100%",
        property: "--listing-fade-start",
        value: "2.5rem",
        reason: "A listing's edge fade: the depth its scroll animates the registered length (@property) to.",
    },
    {
        file: "styles/prose.css",
        context: "@media (min-width: 37.5rem)",
        selector: ".prose > .plate--prose:is(.plate--portrait, .plate--square)",
        property: "grid-template-columns",
        value: "minmax(0, 22rem) minmax(9rem, 15rem)",
        reason: "A tall plate at the text's width with its caption beside it: the picture's and the caption's columns.",
    },
    {
        file: "styles/prose.css",
        context: "@media (min-width: 37.5rem)",
        selector: ".prose > .plate--prose:is(.plate--portrait, .plate--square)",
        property: "max-width",
        value: "min(100%, 40rem)",
        reason: "Caps the picture and its caption together, inside the text's width.",
    },
    {
        file: "styles/prose.css",
        context: "@media (min-width: 37.5rem)",
        selector: ".prose > .plate--prose.plate--square",
        property: "grid-template-columns",
        value: "minmax(0, 24rem) minmax(9rem, 15rem)",
        reason: "A square plate's columns beside its caption, as above.",
    },
    {
        file: "styles/prose.css",
        context: "",
        selector:
            ".plate:is(.plate--wide, .plate--full):is(.plate--portrait, .plate--square) .photo__img",
        property: "max-height",
        value: "88svh",
        reason: "A tall wide plate stays within the screen.",
    },
    {
        file: "styles/prose.css",
        context: "",
        selector: ".fnref",
        property: "line-height",
        value: "0",
        reason: "Keeps a footnote mark from opening its line.",
    },
    {
        file: "styles/prose.css",
        context: "",
        selector: ".fnref a",
        property: "padding",
        value: "0 0.15em",
        reason: "The mark's hit area beside its word, in the mark's own em.",
    },
    {
        file: "components/trajectory/journey.module.css",
        context: "",
        selector: ".card",
        property: "max-width",
        value: "40rem",
        reason: "The flight's record card, capped in its column.",
    },
];

/** Custom properties a component declares and reads itself (a hook set
 *  per state, per frame or inline), with the only files that may declare
 *  or read each; every other custom property is a token. */
export const COMPONENT_PROPERTIES: Readonly<
    Record<string, { files: readonly string[]; reason: string }>
> = {
    "--first-rule": {
        files: [
            "styles/components.css",
            "app/(site)/portfolio/[slug]/mission.module.css",
            "app/(site)/resume/resume.module.css",
            "components/blogs/log-index.module.css",
            "components/portfolio/missions.module.css",
            "components/viewer/viewer.module.css",
        ],
        reason: "A section head hands its hairline to its first row: it sets this to 0, and each ruled list's first row reads it for its rule's width.",
    },
    "--open-to-gap": {
        files: ["styles/components.css"],
        reason: "OpenToItems: the room the separating dot takes between whole parts, per voice.",
    },
    "--list-col": {
        files: ["styles/prose.css"],
        reason: "A prose list's gutter, per kind (a bullet's or a number's).",
    },
    "--btn-h": {
        files: ["styles/components.css", "styles/prose.css"],
        reason: "A button's height, per size (a listing's Copy is the small one).",
    },
    "--log-cols": {
        files: ["components/blogs/log-index.module.css"],
        reason: "Writing's index columns, set once and read by its rows.",
    },
    "--room": {
        files: ["components/blogs/post.module.css"],
        reason: "An entry's room right of the measure, sized from its container.",
    },
    "--reach": {
        files: ["components/blogs/post.module.css"],
        reason: "How far an entry's title and wide plates reach: the nearer of the wide edge and the shell's.",
    },
    "--stage-h": {
        files: ["components/trajectory/journey.module.css"],
        reason: "The flight's stage height, under the header and capped.",
    },
    "--photo-h": {
        files: ["components/home/hero.module.css"],
        reason: "The hero photograph's box height: its crop, from the encoded photograph.",
    },
    "--limb-clear": {
        files: ["components/home/hero.module.css"],
        reason: "The hero copy's clearance above the drawn limb, from the same crop.",
    },
    "--preview-d": {
        files: ["components/home/hero.module.css", "components/home/hero.tsx"],
        reason: "The hero's desktop preview image, set inline from the encoded photograph.",
    },
    "--preview-m": {
        files: ["components/home/hero.module.css", "components/home/hero.tsx"],
        reason: "The hero's phone preview image, set inline from the encoded photograph.",
    },
    "--photo-ratio": {
        files: [
            "styles/components.css",
            "components/prose/figure-plate.tsx",
            "components/ui/plate.tsx",
        ],
        reason: "A plate's aspect ratio, set inline from the image's own.",
    },
    "--photo-focus": {
        files: ["styles/components.css", "components/ui/plate.tsx"],
        reason: "A plate's crop focus, set inline from the image's hotspot.",
    },
    "--metric-cols": {
        files: ["styles/components.css", "components/ui/metrics.tsx"],
        reason: "Metrics' column count, set inline from the number of figures.",
    },
    "--span": {
        files: ["styles/components.css", "components/ui/title-block.tsx"],
        reason: "A title-block cell's span, set inline per cell.",
    },
    "--span-sm": {
        files: ["styles/components.css", "components/ui/title-block.tsx"],
        reason: "A title-block cell's span on a phone, set inline per cell.",
    },
    "--len": {
        files: [
            "components/trajectory/journey.module.css",
            "components/trajectory/journey.tsx",
        ],
        reason: "The flight's route length (its scroll length), set inline.",
    },
    "--wx": {
        files: [
            "components/trajectory/flight.module.css",
            "components/trajectory/trajectory-view.tsx",
        ],
        reason: "A world's x in the wide scene, set per frame.",
    },
    "--wy": {
        files: [
            "components/trajectory/flight.module.css",
            "components/trajectory/trajectory-view.tsx",
        ],
        reason: "A world's y in the wide scene, set per frame.",
    },
    "--nx": {
        files: [
            "components/trajectory/flight.module.css",
            "components/trajectory/trajectory-view.tsx",
        ],
        reason: "A world's x in the narrow scene, set per frame.",
    },
    "--ny": {
        files: [
            "components/trajectory/flight.module.css",
            "components/trajectory/trajectory-view.tsx",
        ],
        reason: "A world's y in the narrow scene, set per frame.",
    },
    "--lift": {
        files: [
            "components/trajectory/flight.module.css",
            "components/trajectory/trajectory-view.tsx",
        ],
        reason: "The sun mark's lift above its world, set per frame.",
    },
    "--d": {
        files: [
            "components/trajectory/flight.module.css",
            "components/trajectory/flight-gl.ts",
        ],
        reason: "A world's drawn diameter, set per frame by the scene.",
    },
    "--record": {
        files: [
            "components/trajectory/flight.module.css",
            "components/trajectory/flight-scene.ts",
        ],
        reason: "Where the record starts on a phone, set by the scene.",
    },
    "--scrim-a": {
        files: [
            "components/trajectory/flight.module.css",
            "components/trajectory/flight-gl.ts",
        ],
        reason: "The scrim's start, per layout, set by the scene.",
    },
    "--scrim-b": {
        files: [
            "components/trajectory/flight.module.css",
            "components/trajectory/flight-gl.ts",
        ],
        reason: "The scrim's end, per layout, set by the scene.",
    },
    "--listing-fade-start": {
        files: ["styles/prose.css"],
        reason: "Registered (@property): a listing's left edge fade, animated by its scroll.",
    },
    "--listing-fade-end": {
        files: ["styles/prose.css"],
        reason: "Registered (@property): a listing's right edge fade, animated by its scroll.",
    },
    "--cluster": {
        files: ["styles/layout.css", "styles/components.css"],
        reason: "A cluster's gap, set by the component that uses one.",
    },
    "--stack": {
        files: ["styles/layout.css"],
        reason: "A stack's gap, set by the component that uses one.",
    },
    "--patch-sun": {
        files: ["styles/components.css"],
        reason: "The patch sprite's sun fill, per placement.",
    },
    "--patch-band": {
        files: ["styles/components.css"],
        reason: "The patch sprite's lettered band, per placement.",
    },
};

/** next/font's variables, set on <html> at run time (lib/fonts.ts). */
export const RUNTIME_PROPERTIES = [
    "--font-jost",
    "--font-newsreader",
    "--font-newsreader-italic",
    "--font-dm-mono",
    "--font-michroma",
] as const;

/** Colours drawn in code that are scene art, not the palette. */
export const SCENE_COLOURS: Readonly<Record<string, readonly string[]>> = {
    // The Sun's corona over the limb, and the air along it.
    "components/trajectory/trajectory-view.tsx": [
        "#fff6ea",
        "#fff2e4",
        "#ffefe0",
        "#ffeede",
        "#f4f7ff",
        "#c2d4ff",
        "#7a9cf0",
        "#5a80e0",
    ],
    // The giants' and Mars's limb rims, the oceans' glint, the city
    // lights, the earthshine, the wings' slate, the plume and its glow.
    "components/trajectory/flight-gl.ts": [
        "0.16, 0.16, 0.17",
        "0.15, 0.15, 0.15",
        "0.1, 0.09, 0.08",
        "0.1, 0.105, 0.12",
        "1, 0.93, 0.82",
        "0.5, 0.56, 0.66",
        "#8b929e",
        "#dfe8ff",
        "rgba(235,242,255,1)",
        "rgba(210,225,255,0.45)",
        "rgba(200,220,255,0)",
    ],
    // Earth's air (a clear blue warming toward the Sun), the rings'
    // shadow tint, and the stars' blue-white and warm white.
    "components/trajectory/flight-bodies.ts": [
        "0.32, 0.55, 1.0",
        "1.0, 0.94, 0.86",
        "0xd8d2c6",
        "0.78, 0.86, 1.0",
        "1.0, 0.92, 0.82",
    ],
};

/** The patch's mask: white shows, black knocks out (inside <mask> only). */
export const MASK_COLOURS: Readonly<Record<string, readonly string[]>> = {
    "scripts/generate-patch.mjs": ["#fff", "#000"],
    "lib/patch.json": ["#fff", "#000"],
};

/** Global classes that are also Tailwind utilities, where the utility's
 *  one declaration is what the element needs anyway. */
export const TAILWIND_COLLISIONS: Readonly<Record<string, string>> = {
    grid: "display: grid, which layout.css's .grid also sets.",
    table: "display: table, the element's own.",
};
