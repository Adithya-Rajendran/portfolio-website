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
    {
        file: "components/cv/experience-views.module.css",
        context: "",
        selector: ".skip:not(:focus-visible)",
        property: "width",
        value: "1px",
        reason: "Skip to the list is visually hidden until focused: Tailwind's sr-only values, but conditional, and the element carries a module class (no utility on it).",
    },
    {
        file: "components/cv/experience-views.module.css",
        context: "",
        selector: ".skip:not(:focus-visible)",
        property: "height",
        value: "1px",
        reason: "Skip to the list is visually hidden until focused: Tailwind's sr-only values, but conditional, and the element carries a module class (no utility on it).",
    },
    {
        file: "components/cv/experience-views.module.css",
        context: "",
        selector: ".skip:not(:focus-visible)",
        property: "margin",
        value: "-1px",
        reason: "Skip to the list is visually hidden until focused: Tailwind's sr-only values, but conditional, and the element carries a module class (no utility on it).",
    },
    {
        file: "components/home/hero.module.css",
        context: "",
        selector: ".hero",
        property: "--photo-h",
        value: "min(100cqw * 1646 / 3840, 0.82 * (100svh - var(--header-h)))",
        reason: "The hero photograph's crop: its box's share of the encoded frame and of the viewport (lib/hero-sunrise.json).",
    },
    {
        file: "components/home/hero.module.css",
        context: "@media (max-width: 47.99rem)",
        selector: ".hero",
        property: "--photo-h",
        value: "min(100cqw * 16 / 9, 0.94 * (100svh - var(--header-h)))",
        reason: "The hero photograph's crop: its box's share of the encoded frame and of the viewport (lib/hero-sunrise.json).",
    },
    {
        file: "components/home/hero.module.css",
        context: "",
        selector: ".hero",
        property: "--limb-clear",
        value: "calc(var(--photo-h) * 0.47)",
        reason: "The hero copy's clearance above the drawn limb: a share of the same crop.",
    },
    {
        file: "components/home/hero.module.css",
        context: "@media (max-width: 47.99rem)",
        selector: ".hero",
        property: "--limb-clear",
        value: "calc(var(--photo-h) * 0.3)",
        reason: "The hero copy's clearance above the drawn limb: a share of the same crop.",
    },
    {
        file: "components/portfolio/missions.module.css",
        context: "",
        selector: ".tileArrow",
        property: "top",
        value: "0.1rem",
        reason: "Optical: the tile's arrow sits on its line's cap height.",
    },
    {
        file: "components/trajectory/flight.module.css",
        context: "",
        selector: ".sunrise",
        property: "left",
        value: "calc(var(--wx) - 200cqh)",
        reason: "Scene geometry: the sunrise image placed on its world (--wx/--wy, a phone's --nx/--ny), in the stage's container units.",
    },
    {
        file: "components/trajectory/flight.module.css",
        context: "",
        selector: ".sunrise",
        property: "top",
        value: "calc(var(--wy) - 50cqh)",
        reason: "Scene geometry: the sunrise image placed on its world (--wx/--wy, a phone's --nx/--ny), in the stage's container units.",
    },
    {
        file: "components/trajectory/flight.module.css",
        context: "",
        selector: ".sunrise",
        property: "width",
        value: "300cqh",
        reason: "Scene geometry: the sunrise image placed on its world (--wx/--wy, a phone's --nx/--ny), in the stage's container units.",
    },
    {
        file: "components/trajectory/flight.module.css",
        context: "",
        selector: ".sunrise",
        property: "height",
        value: "150cqh",
        reason: "Scene geometry: the sunrise image placed on its world (--wx/--wy, a phone's --nx/--ny), in the stage's container units.",
    },
    {
        file: "components/trajectory/flight.module.css",
        context: "@media (max-width: 59.99rem)",
        selector: ".sunrise",
        property: "left",
        value: "calc(var(--nx) - 200cqh)",
        reason: "Scene geometry: the sunrise image placed on its world (--wx/--wy, a phone's --nx/--ny), in the stage's container units.",
    },
    {
        file: "components/trajectory/flight.module.css",
        context: "@media (max-width: 59.99rem)",
        selector: ".sunrise",
        property: "top",
        value: "calc(var(--ny) - 50cqh)",
        reason: "Scene geometry: the sunrise image placed on its world (--wx/--wy, a phone's --nx/--ny), in the stage's container units.",
    },
    {
        file: "components/trajectory/flight.module.css",
        context: "",
        selector: ".sunMark",
        property: "left",
        value: "calc(var(--wx) - 20px)",
        reason: "Scene geometry: the 40px printed sun centred on its world, lifted by --lift.",
    },
    {
        file: "components/trajectory/flight.module.css",
        context: "",
        selector: ".sunMark",
        property: "top",
        value: "calc(var(--wy) - var(--lift) - 20px)",
        reason: "Scene geometry: the 40px printed sun centred on its world, lifted by --lift.",
    },
    {
        file: "components/trajectory/flight.module.css",
        context: "",
        selector: ".sunMark",
        property: "width",
        value: "40px",
        reason: "Scene geometry: the 40px printed sun centred on its world, lifted by --lift.",
    },
    {
        file: "components/trajectory/flight.module.css",
        context: "",
        selector: ".sunMark",
        property: "height",
        value: "40px",
        reason: "Scene geometry: the 40px printed sun centred on its world, lifted by --lift.",
    },
    {
        file: "components/trajectory/flight.module.css",
        context: "@media (max-width: 59.99rem)",
        selector: ".sunMark",
        property: "left",
        value: "calc(var(--nx) - 20px)",
        reason: "Scene geometry: the 40px printed sun centred on its world, lifted by --lift.",
    },
    {
        file: "components/trajectory/flight.module.css",
        context: "@media (max-width: 59.99rem)",
        selector: ".sunMark",
        property: "top",
        value: "calc(var(--ny) - var(--lift) - 20px)",
        reason: "Scene geometry: the 40px printed sun centred on its world, lifted by --lift.",
    },
    {
        file: "components/trajectory/flight.module.css",
        context: "",
        selector: ".label",
        property: "gap",
        value: "3px",
        reason: "A map label's knockout: a feathered plate a few pixels past the text (the site's one radius and shadow).",
    },
    {
        file: "components/trajectory/flight.module.css",
        context: "",
        selector: ".label",
        property: "padding",
        value: "1px 4px",
        reason: "A map label's knockout: a feathered plate a few pixels past the text (the site's one radius and shadow).",
    },
    {
        file: "components/trajectory/flight.module.css",
        context: "",
        selector: ".label",
        property: "border-radius",
        value: "4px",
        reason: "A map label's knockout: a feathered plate a few pixels past the text (the site's one radius and shadow).",
    },
    {
        file: "components/trajectory/flight.module.css",
        context: "",
        selector: ".label",
        property: "box-shadow",
        value: "0 0 8px 6px var(--label-knockout)",
        reason: "A map label's knockout: a feathered plate a few pixels past the text (the site's one radius and shadow).",
    },
    {
        file: "components/trajectory/flight.module.css",
        context: "",
        selector: ".name",
        property: "max-width",
        value: "17em",
        reason: "A map name's two-line width, in its own em.",
    },
    {
        file: "components/trajectory/flight.module.css",
        context: "",
        selector: ".world::before",
        property: "width",
        value: "var(--d, 11px)",
        reason: "Scene geometry: the ring round a world's drawn disc (--d, set per frame; 11px before the first).",
    },
    {
        file: "components/trajectory/flight.module.css",
        context: "",
        selector: ".world::before",
        property: "height",
        value: "var(--d, 11px)",
        reason: "Scene geometry: the ring round a world's drawn disc (--d, set per frame; 11px before the first).",
    },
    {
        file: "components/trajectory/flight.module.css",
        context: "",
        selector: ".target::before",
        property: "width",
        value: "9px",
        reason: "Scene geometry: the planned orbit's end ring.",
    },
    {
        file: "components/trajectory/flight.module.css",
        context: "",
        selector: ".target::before",
        property: "height",
        value: "9px",
        reason: "Scene geometry: the planned orbit's end ring.",
    },
    {
        file: "components/trajectory/flight.module.css",
        context: "",
        selector: ".scrim",
        property: "background",
        value: "linear-gradient( var(--scrim-dir, 90deg), color-mix(in oklab, var(--bg) 96%, transparent) var(--scrim-from), color-mix(in oklab, var(--bg) 93.9%, transparent) calc(var(--scrim-from) + var(--scrim-span) * 0.088), color-mix(in oklab, var(--bg) 88.1%, transparent) calc(var(--scrim-from) + var(--scrim-span) * 0.176), color-mix(in oklab, var(--bg) 79.4%, transparent) calc(var(--scrim-from) + var(--scrim-span) * 0.265), color-mix(in oklab, var(--bg) 68.5%, transparent) calc(var(--scrim-from) + var(--scrim-span) * 0.353), color-mix(in oklab, var(--bg) 56.4%, transparent) calc(var(--scrim-from) + var(--scrim-span) * 0.441), color-mix(in oklab, var(--bg) 43.9%, transparent) calc(var(--scrim-from) + var(--scrim-span) * 0.529), color-mix(in oklab, var(--bg) 31.4%, transparent) calc(var(--scrim-from) + var(--scrim-span) * 0.618), color-mix(in oklab, var(--bg) 20%, transparent) calc(var(--scrim-from) + var(--scrim-span) * 0.706), color-mix(in oklab, var(--bg) 10.6%, transparent) calc(var(--scrim-from) + var(--scrim-span) * 0.794), color-mix(in oklab, var(--bg) 3.8%, transparent) calc(var(--scrim-from) + var(--scrim-span) * 0.882), transparent calc(var(--scrim-from) + var(--scrim-span)) )",
        reason: "The scrim's eased ramp: a smoothstep in twelfths of the page's ground, so no bands show over the scene.",
    },
    {
        file: "components/trajectory/journey.module.css",
        context: "",
        selector: ".rail button",
        property: "grid-template-columns",
        value: "3.4rem auto",
        reason: "The rail's stop: its date column, then its name.",
    },
    {
        file: "components/trajectory/journey.module.css",
        context: "",
        selector: ".rail button",
        property: "min-height",
        value: "34px",
        reason: "The rail's px geometry: each stop's dot sits on the 1px rail at every text size.",
    },
    {
        file: "components/trajectory/journey.module.css",
        context: "",
        selector: ".rail button",
        property: "margin-left",
        value: "12px",
        reason: "The rail's px geometry: each stop's dot sits on the 1px rail at every text size.",
    },
    {
        file: "components/trajectory/journey.module.css",
        context: "",
        selector: ".rail button",
        property: "padding",
        value: "6px",
        reason: "The rail's px geometry: each stop's dot sits on the 1px rail at every text size.",
    },
    {
        file: "components/trajectory/journey.module.css",
        context: "",
        selector: ".rail button::before",
        property: "left",
        value: "-16px",
        reason: "The rail's px geometry: each stop's dot sits on the 1px rail at every text size.",
    },
    {
        file: "components/trajectory/journey.module.css",
        context: "@media (min-width: 60rem) and (max-height: 51.25rem)",
        selector: ".rail button",
        property: "min-height",
        value: "28px",
        reason: "The rail's px geometry, tighter on a short laptop window.",
    },
    {
        file: "components/trajectory/journey.module.css",
        context: "@media (min-width: 60rem) and (max-height: 51.25rem)",
        selector: ".rail button",
        property: "padding-block",
        value: "4px",
        reason: "The rail's px geometry, tighter on a short laptop window.",
    },
    {
        file: "components/trajectory/journey.module.css",
        context: "@media (max-width: 59.99rem)",
        selector: ".rail button",
        property: "min-height",
        value: "36px",
        reason: "The rail's px geometry on a phone: the stops across the stage's foot, each dot on the rail.",
    },
    {
        file: "components/trajectory/journey.module.css",
        context: "@media (max-width: 59.99rem)",
        selector: ".rail button",
        property: "margin",
        value: "8px 0 0",
        reason: "The rail's px geometry on a phone: the stops across the stage's foot, each dot on the rail.",
    },
    {
        file: "components/trajectory/journey.module.css",
        context: "@media (max-width: 59.99rem)",
        selector: ".rail button",
        property: "padding",
        value: "6px 0 4px",
        reason: "The rail's px geometry on a phone: the stops across the stage's foot, each dot on the rail.",
    },
    {
        file: "components/trajectory/journey.module.css",
        context: "@media (max-width: 59.99rem)",
        selector: ".rail button::before",
        property: "top",
        value: "-12px",
        reason: "The rail's px geometry on a phone: the stops across the stage's foot, each dot on the rail.",
    },
    {
        file: "components/trajectory/journey.module.css",
        context: "@media (max-width: 59.99rem)",
        selector: ":global(html[data-js]) .entry::after",
        property: "inset",
        value: "-14px -8px",
        reason: "Full entry's touch target, extended past its words on a phone.",
    },
    {
        file: "components/trajectory/journey.module.css",
        context: "@media (prefers-reduced-motion: no-preference)",
        selector: ':global(html[data-js][data-motion="full"]) .journey',
        property: "height",
        value: "calc((100 + var(--len)) * 1vh)",
        reason: "The pinned flight's scroll length: one viewport plus the route's length (--len), in viewport units (svh where supported).",
    },
    {
        file: "components/trajectory/journey.module.css",
        context: "@media (prefers-reduced-motion: no-preference)",
        selector: ':global(html[data-js][data-motion="full"]) .journey',
        property: "height",
        value: "calc((100 + var(--len)) * 1svh)",
        reason: "The pinned flight's scroll length: one viewport plus the route's length (--len), in viewport units (svh where supported).",
    },
    {
        file: "components/trajectory/journey.module.css",
        context: "@media (max-width: 59.99rem)",
        selector: ".name",
        property: "width",
        value: "1px",
        reason: "The rail's names are hidden on a phone only (sr-only values under the phone query); the wider layout shows them.",
    },
    {
        file: "components/trajectory/journey.module.css",
        context: "@media (max-width: 59.99rem)",
        selector: ".name",
        property: "height",
        value: "1px",
        reason: "The rail's names are hidden on a phone only (sr-only values under the phone query); the wider layout shows them.",
    },
    {
        file: "components/trajectory/journey.module.css",
        context: "@media (max-width: 59.99rem)",
        selector: ".name",
        property: "margin",
        value: "-1px",
        reason: "The rail's names are hidden on a phone only (sr-only values under the phone query); the wider layout shows them.",
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
    "--scrim-from": {
        files: ["components/trajectory/flight.module.css"],
        reason: "Where the scrim's ramp starts: --scrim-a, or a phone's own.",
    },
    "--scrim-span": {
        files: ["components/trajectory/flight.module.css"],
        reason: "How far the scrim's ramp runs, from --scrim-from to --scrim-b.",
    },
    "--scrim-dir": {
        files: ["components/trajectory/flight.module.css"],
        reason: "The scrim's direction: across a wide stage, up from a phone's foot.",
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
