import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import tailwind from "@tailwindcss/postcss";
import postcss, {
    type AtRule,
    type Container,
    type Declaration,
    type Rule,
} from "postcss";
import ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";
import { BREAKPOINTS, HEIGHTS } from "@/lib/breakpoints";
import {
    ALLOWANCES,
    COMPONENT_PROPERTIES,
    MASK_COLOURS,
    RUNTIME_PROPERTIES,
    SCENE_COLOURS,
    TAILWIND_COLLISIONS,
} from "./design-system.allow";

/**
 * The design system's contract (CLAUDE.md, styles/tokens.css): every
 * literal in the stylesheets the site ships is a token in
 * styles/tokens.css, and components read roles, never the palette or the
 * ladder. This test parses every stylesheet with postcss, and the
 * TypeScript under app/, components/ and lib/ with the compiler API, and
 * refuses what the contract does not allow. Exceptions are
 * tests/lib/design-system.allow.ts's, each with its reason; an exception
 * that excuses nothing fails.
 */

const ROOT = process.cwd();
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");
const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

function walk(dir: string, keep: (file: string) => boolean): string[] {
    return (readdirSync(path.join(ROOT, dir), { recursive: true }) as string[])
        .map((file) => `${dir}/${file.split(path.sep).join("/")}`)
        .filter((file) => !file.includes("node_modules/") && keep(file))
        .sort();
}

const TOKENS_FILE = "styles/tokens.css";
const GLOBALS_FILE = "app/globals.css";
/** The Studio is not the site: it loads none of this. */
const outsideStudio = (file: string) => !file.startsWith("app/studio/");

const STYLESHEETS = [
    ...walk("styles", (file) => file.endsWith(".css")),
    GLOBALS_FILE,
    ...walk(
        "app",
        (file) => file.endsWith(".module.css") && outsideStudio(file),
    ),
    ...walk("components", (file) => file.endsWith(".module.css")),
];

const SOURCES = ["app", "components", "lib"].flatMap((dir) =>
    walk(
        dir,
        (file) =>
            /\.tsx?$/.test(file) &&
            !file.endsWith(".d.ts") &&
            outsideStudio(file),
    ),
);

// ---- parsing ----------------------------------------------------------

interface Decl {
    file: string;
    line: number;
    /** The at-rule chain (and any enclosing rule), outermost first, with
     *  no `@layer`; '' at the top level. */
    context: string;
    selector: string;
    property: string;
    value: string;
    paper: boolean;
    forced: boolean;
    hover: boolean;
    theme: boolean;
    parent: Container;
}

function chainOf(node: { parent?: Container | undefined }): string[] {
    const chain: string[] = [];
    for (
        let up = node.parent;
        up && up.type !== "root";
        up = up.parent as Container | undefined
    ) {
        if (up.type === "atrule") {
            const at = up as AtRule;
            if (at.name !== "layer")
                chain.unshift(collapse(`@${at.name} ${at.params}`));
        } else if (up.type === "rule") {
            chain.unshift(collapse((up as Rule).selector));
        }
    }
    return chain;
}

function declsOf(file: string, root: postcss.Root): Decl[] {
    const out: Decl[] = [];
    root.walkDecls((node: Declaration) => {
        const parent = node.parent as Container;
        const chain = chainOf(node);
        let selector = "";
        if (parent.type === "rule") {
            selector = chain.pop() ?? "";
        }
        const context = chain.join(" > ");
        out.push({
            file,
            line: node.source?.start?.line ?? 0,
            context,
            selector,
            property: node.prop,
            value: collapse(node.value),
            paper: chain.some(
                (at) =>
                    (at.startsWith("@media") && /\bprint\b/.test(at)) ||
                    at.startsWith("@page"),
            ),
            forced: context.includes("forced-colors: active"),
            hover: context.includes("(hover: hover)"),
            theme: chain.some((at) => at.startsWith("@theme")),
            parent,
        });
    });
    return out;
}

const ROOTS = new Map(
    STYLESHEETS.map((file) => [
        file,
        postcss.parse(read(file), { from: file }),
    ]),
);
const DECLS = STYLESHEETS.flatMap((file) => declsOf(file, ROOTS.get(file)!));

/** tokens.css's names, each with its values (one per theme or media). */
const TOKENS = new Map<string, string[]>();
for (const decl of DECLS) {
    if (decl.file !== TOKENS_FILE || !decl.property.startsWith("--")) continue;
    TOKENS.set(decl.property, [
        ...(TOKENS.get(decl.property) ?? []),
        decl.value,
    ]);
}

// ---- values -----------------------------------------------------------

const stripStrings = (value: string) =>
    value
        .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""')
        .replace(/url\([^)]*\)/g, "url()");

/** Removes every `var(--name)` read, and the name of one with a
 *  fallback, so the fallback's own literals still count. */
function stripVars(value: string): string {
    let out = stripStrings(value);
    for (let prev = ""; prev !== out;) {
        prev = out;
        out = out.replace(/var\(\s*--[\w-]+\s*\)/g, "");
    }
    return out.replace(/var\(\s*--[\w-]+\s*,/g, "(");
}

const varNames = (value: string) =>
    [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1]);

const UNITS =
    "px|rem|em|ch|ex|cap|lh|rlh|vw|vh|vi|vb|vmin|vmax|svw|svh|dvw|dvh|lvw|lvh|cqw|cqh|cqi|pt|mm|cm|in";
const LENGTH = new RegExp(
    `(?<![\\w.#-])(-?(?:\\d+\\.?\\d*|\\.\\d+))(${UNITS})(?![\\w-])`,
    "g",
);
const WHOLE = new Set([
    "100vw",
    "100vh",
    "100svh",
    "100dvh",
    "100lvh",
    "100cqw",
    "100cqh",
    "100cqi",
    "1lh",
]);

/** The length literals in a value (not 0, the whole viewport or 1lh). */
function lengths(value: string): string[] {
    return [...stripVars(value).matchAll(LENGTH)]
        .filter(([text, number]) => Number(number) !== 0 && !WHOLE.has(text))
        .map(([text]) => text);
}

/** The non-integer factors inside calc(), min(), max() or clamp(). */
function factors(value: string): string[] {
    const text = stripVars(value);
    const out: string[] = [];
    for (const match of text.matchAll(/(?<![\w-])(calc|min|max|clamp)\(/g)) {
        let depth = 0;
        let end = match.index + match[0].length - 1;
        for (; end < text.length; end++) {
            if (text[end] === "(") depth++;
            else if (text[end] === ")" && --depth === 0) break;
        }
        const inner = text.slice(match.index, end + 1);
        for (const [number] of inner.matchAll(
            /(?<![\w.#-])-?(?:\d+\.\d*|\.\d+)(?![\w.%])/g,
        )) {
            if (!Number.isInteger(Number(number))) out.push(number);
        }
    }
    return [...new Set(out)];
}

/** Whether a token's value is (or reads) a length. */
function isLengthToken(name: string, depth = 0): boolean {
    if (depth > 8) return false;
    return (TOKENS.get(name) ?? []).some(
        (value) =>
            [...stripVars(value).matchAll(LENGTH)].length > 0 ||
            varNames(value).some((ref) => isLengthToken(ref, depth + 1)),
    );
}

// ---- colours ----------------------------------------------------------

const NAMED_COLOURS = new Set(
    (
        "aliceblue antiquewhite aqua aquamarine azure beige bisque black " +
        "blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse " +
        "chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan " +
        "darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta " +
        "darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen " +
        "darkslateblue darkslategray darkslategrey darkturquoise darkviolet " +
        "deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite " +
        "forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green " +
        "greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender " +
        "lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan " +
        "lightgoldenrodyellow lightgray lightgreen lightgrey lightpink " +
        "lightsalmon lightseagreen lightskyblue lightslategray lightslategrey " +
        "lightsteelblue lightyellow lime limegreen linen magenta maroon " +
        "mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen " +
        "mediumslateblue mediumspringgreen mediumturquoise mediumvioletred " +
        "midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive " +
        "olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise " +
        "palevioletred papayawhip peachpuff peru pink plum powderblue purple " +
        "rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown " +
        "seagreen seashell sienna silver skyblue slateblue slategray slategrey " +
        "snow springgreen steelblue tan teal thistle tomato turquoise violet " +
        "wheat white whitesmoke yellow yellowgreen"
    ).split(" "),
);
const SYSTEM_COLOURS = new Set(
    (
        "canvas canvastext linktext visitedtext activetext buttonface " +
        "buttontext buttonborder field fieldtext highlight highlighttext " +
        "selecteditem selecteditemtext mark marktext graytext accentcolor " +
        "accentcolortext"
    ).split(" "),
);
const COLOUR_PROPERTY =
    /^(color|background(-color|-image)?|border(-(top|right|bottom|left|block|inline)(-(start|end))?)?(-color)?|outline(-color)?|fill|stroke|text-decoration(-color)?|caret-color|accent-color|box-shadow|text-shadow|column-rule(-color)?|scrollbar-color|-webkit-text-fill-color|-webkit-tap-highlight-color|-webkit-text-stroke(-color)?|stop-color|flood-color|lighting-color|filter|backdrop-filter|mask(-image)?|-webkit-mask(-image)?)$/;
const MASK_PROPERTY = /^(-webkit-)?mask(-image)?$/;
const HEX = /(?<![\w&])#[0-9a-fA-F]{3,8}(?![\w-])/g;
const COLOUR_FUNCTION =
    /(?<![\w-])(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/g;

/** The colour literals in a value: hexes, colour functions and, in a
 *  property that takes a colour, named and system colours. */
function colours(property: string, value: string) {
    const text = stripVars(value);
    const found = [
        ...[...text.matchAll(HEX)].map(([hex]) => hex.toLowerCase()),
        ...[...text.matchAll(COLOUR_FUNCTION)].map(([fn]) => fn),
    ];
    const system: string[] = [];
    if (property.startsWith("--") || COLOUR_PROPERTY.test(property)) {
        for (const [word] of text.matchAll(
            /(?<![\w-])[a-zA-Z][a-zA-Z-]*(?![\w(-])/g,
        )) {
            const lower = word.toLowerCase();
            if (NAMED_COLOURS.has(lower)) found.push(lower);
            if (SYSTEM_COLOURS.has(lower)) system.push(lower);
        }
    }
    return { found, system };
}

const PALETTE_READ =
    /var\(\s*--(void-[\w-]+|manual-[\w-]+|paper-white|ink-[123]|rule-[12]|surface-[12]|accent|star-rgb)\s*[,)]/;

// ---- failures ---------------------------------------------------------

interface Failure {
    rule: string;
    file: string;
    line: number;
    context: string;
    selector: string;
    property: string;
    value: string;
    why: string;
}

const declFailure = (
    decl: Decl,
    rule: string,
    why: string,
    property = decl.property,
): Failure => ({
    rule,
    file: decl.file,
    line: decl.line,
    context: decl.context,
    selector: decl.selector,
    property,
    value: decl.value,
    why,
});

const sourceFailure = (
    rule: string,
    file: string,
    line: number,
    snippet: string,
    why: string,
): Failure => ({
    rule,
    file,
    line,
    context: "",
    selector: "",
    property: snippet,
    value: "",
    why,
});

const componentFiles = (name: string): readonly string[] =>
    Object.hasOwn(COMPONENT_PROPERTIES, name)
        ? COMPONENT_PROPERTIES[name].files
        : [];

const RUNTIME = new Set<string>(RUNTIME_PROPERTIES);

const isRole = (value: string, pattern: string) =>
    new RegExp(`^var\\(--(${pattern})\\)$`).test(value);

function siblings(decl: Decl): Map<string, string> {
    const map = new Map<string, string>();
    decl.parent.each((node) => {
        if (node.type === "decl") map.set(node.prop, collapse(node.value));
    });
    return map;
}

/** R3's companions: what a role needs beside it in the same rule. */
function missingCompanions(role: string, decl: Decl): string | null {
    const near = siblings(decl);
    const tracking = near.get("letter-spacing");
    const caps = near.get("text-transform") === "uppercase";
    const numerals = near.get("font-variant-numeric") ?? "";
    const needs: Record<string, () => boolean> = {
        label: () => tracking === "var(--track-label)" && caps,
        control: () => tracking === "var(--track-control)" && caps,
        mark: () =>
            tracking === "var(--track-mark)" ||
            tracking === "var(--track-wordmark)",
        name: () => tracking === "var(--track-name)" && caps,
        "title-md": () => tracking === "var(--track-title)",
        "title-lg": () => tracking === "var(--track-title)",
        "title-xl": () => tracking === "var(--track-title)",
        display: () => tracking === "var(--track-display)",
        "display-lg": () => tracking === "var(--track-display)",
        data: () => /^var\(--numerals-[\w-]+\)$/.test(numerals),
        long: () => numerals === "var(--numerals-text)",
    };
    const check = needs[role];
    return check && !check() ? `--type-${role} without its companions` : null;
}

const R12_PROPERTY =
    /^(margin(-.+)?|padding(-.+)?|gap|row-gap|column-gap|grid-gap|scroll-margin(-.+)?|scroll-padding(-.+)?|top|right|bottom|left|inset(-.+)?|width|height|min-.+|max-.+|inline-size|block-size|flex|flex-basis|grid|grid-template(-.+)?|grid-auto-.+|columns|column-width|border(-[a-z]+)*-radius|box-shadow|text-shadow|-webkit-text-stroke|contain-intrinsic-size|vertical-align|text-indent)$/;
const BORDER_WIDTH = /^(border|outline|column-rule)/;
const NOT_A_WIDTH = /(radius|color|style|collapse|spacing|image|offset)/;

/** Whether a rule width token is allowed where it is. */
function ruleWidthOk(name: string, decl: Decl): boolean {
    if (decl.paper) return /^--(paper|rule)-/.test(name);
    return name === "--rule-hair" || name === "--rule-strong";
}

/** Every failure of one declaration outside tokens.css. */
function declarationFailures(decl: Decl): Failure[] {
    const out: Failure[] = [];
    const fail = (rule: string, why: string) =>
        out.push(declFailure(decl, rule, why));
    const { property: prop, value } = decl;

    // R13: every var() read resolves to a token, a component property
    // read from one of its files, or next/font's variables.
    for (const name of varNames(value)) {
        if (
            !TOKENS.has(name) &&
            !RUNTIME.has(name) &&
            !componentFiles(name).includes(decl.file)
        )
            fail("R13", `reads ${name}, which is not a token`);
    }

    // R2: the palette and the ladder are tokens.css's.
    if (PALETTE_READ.test(value))
        fail("R2", "reads the palette or the ladder (read a role)");

    // R1: colour literals.
    const { found, system } = colours(prop, value);
    if (MASK_PROPERTY.test(prop)) {
        const bad = found.filter((c) => !["#000", "black"].includes(c));
        if (bad.length) fail("R1", `colour ${bad.join(", ")} in a mask`);
    } else if (found.length) {
        fail("R1", `colour literal ${found.join(", ")}`);
    }
    if (system.length && !decl.forced)
        fail("R1", `system colour ${system.join(", ")} outside forced colours`);
    if (
        prop === "opacity" &&
        !/^(0|1|inherit|var\(--(opacity|star-alpha)-[\w-]+\))$/.test(value)
    )
        fail("R1", "opacity off its tokens");

    if (prop.startsWith("--")) {
        // R12c: a custom property outside tokens.css is a component's.
        if (!componentFiles(prop).includes(decl.file))
            fail("R12c", `${prop} is not a component property of this file`);
        const literal = [...lengths(value), ...factors(value)];
        if (literal.length && !decl.paper)
            fail("R12c", `length literal ${literal.join(" ")}`);
        return out;
    }

    // R3: font is a role (or, on paper, built from the paper's tokens).
    if (prop === "font") {
        const role = /^var\(--type-([\w-]+)\)$/.exec(value);
        const paperFont =
            /^(var\(--weight-[\w-]+\) )?var\(--print-[\w-]+\)( ?\/ ?(var\(--lh-[\w-]+\)|normal))? var\(--font-[\w-]+\)$/;
        if (role) {
            const missing = missingCompanions(role[1], decl);
            if (missing) fail("R3", missing);
        } else if (
            value !== "inherit" &&
            !(decl.paper && paperFont.test(value))
        )
            fail("R3", "font is not a role");
    }

    // R4: size, weight, family and numerals.
    if (
        prop === "font-size" &&
        value !== "inherit" &&
        !isRole(value, "label-size|step-[0-6]|step-long|size-[\\w-]+") &&
        !(decl.paper && isRole(value, "print-[\\w-]+"))
    )
        fail("R4", "font-size off the scale");
    if (
        prop === "font-weight" &&
        value !== "inherit" &&
        !isRole(value, "weight-[\\w-]+")
    )
        fail("R4", "font-weight off the scale");
    if (
        prop === "font-family" &&
        value !== "inherit" &&
        !isRole(value, "font-[\\w-]+")
    )
        fail("R4", "font-family is not a token");
    if (
        prop === "font-variant-numeric" &&
        value !== "normal" &&
        !isRole(value, "numerals-[\\w-]+")
    )
        fail("R4", "numerals are not a token");

    // R5: line-height.
    if (prop === "line-height") {
        const tokensOnly =
            value.startsWith("calc(") &&
            !/\d/.test(value.replace(/var\([^)]*\)/g, ""));
        if (
            !isRole(value, "lh-[\\w-]+") &&
            !["inherit", "normal"].includes(value) &&
            !tokensOnly
        )
            fail("R5", "line-height off the scale");
    }

    // R6: tracking.
    if (
        (prop === "letter-spacing" || prop === "word-spacing") &&
        !isRole(value, "track-[\\w-]+") &&
        !["0", "normal", "inherit"].includes(value)
    )
        fail("R6", "tracking off the scale");

    // R7: durations and easings.
    if (/^(transition|animation)(-|$)/.test(prop)) {
        const timed = stripVars(value);
        const durations = [
            ...timed.matchAll(/(?<![\w.-])(\d*\.?\d+)(ms|s)(?![\w-])/g),
        ].filter(([, number]) => Number(number) !== 0);
        if (durations.length)
            fail(
                "R7",
                `duration literal ${durations.map(([d]) => d).join(" ")}`,
            );
        if (
            /(?<![\w-])(ease|ease-in|ease-out|ease-in-out)(?![\w-])|cubic-bezier\(/.test(
                timed,
            )
        )
            fail("R7", "easing literal");
        if (
            /timing-function$/.test(prop) &&
            !value
                .split(",")
                .every((item) =>
                    /^(var\(--ease-[\w-]+\)|linear|steps\(.*\))$/.test(
                        item.trim(),
                    ),
                )
        )
            fail("R7", "easing is not a token");
    }

    // R8: nudges and origins.
    const translates = [
        ...value.matchAll(/translate(?:3d|[XYZ])?\(([^()]*(?:\([^()]*\))*)\)/g),
    ].flatMap(([, args]) => lengths(args));
    if (
        translates.length ||
        ((prop === "translate" || prop === "transform-origin") &&
            lengths(value).length)
    )
        fail("R8", "length literal in a nudge or an origin");

    // R9: underlines and focus.
    if (
        prop === "text-underline-offset" &&
        !/^var\(--underline-offset[\w-]*\)$/.test(value)
    )
        fail("R9", "underline offset is not a token");
    if (
        prop === "text-decoration-thickness" &&
        !isRole(value, "underline-w[\\w-]*|rule-[\\w-]+")
    )
        fail("R9", "underline thickness is not a token");
    if (prop === "text-decoration") {
        const thick = varNames(value).filter(
            (name) =>
                isLengthToken(name) && !/^--(underline-w|rule-)/.test(name),
        );
        if (lengths(value).length || thick.length)
            fail("R9", "underline thickness is not a token");
    }
    if (
        prop === "outline-offset" &&
        value !== "0" &&
        !isRole(value, "focus-offset[\\w-]*")
    )
        fail("R9", "outline offset is not a token");
    if (
        (prop === "outline" || prop === "outline-width") &&
        !["var(--focus-ring)", "none", "0", "inherit"].includes(value)
    ) {
        const width = varNames(value).filter(
            (name) =>
                isLengthToken(name) &&
                !/^--rule-/.test(name) &&
                name !== "--target-halo",
        );
        if (width.length) fail("R9", "outline width is not a rule token");
    }

    // R10: rule widths.
    if (BORDER_WIDTH.test(prop) && !NOT_A_WIDTH.test(prop)) {
        const literal = lengths(value);
        if (
            literal.length ||
            /(?<![\w-])(thin|medium|thick)(?![\w-])/.test(value)
        )
            fail("R10", `rule width literal ${literal.join(" ")}`.trim());
        if (!prop.startsWith("outline")) {
            const hook = /^var\((--[\w-]+), var\((--rule-[\w-]+)\)\)$/.exec(
                value,
            );
            const widths = hook
                ? componentFiles(hook[1]).includes(decl.file)
                    ? []
                    : [hook[1]]
                : varNames(value).filter(
                      (name) => isLengthToken(name) && !ruleWidthOk(name, decl),
                  );
            if (widths.length)
                fail("R10", `rule width ${widths.join(", ")} is not a rule`);
        }
    }
    if (prop === "stroke-width" && !isRole(value, "(stroke|star)(-[\\w-]+)?"))
        fail("R10", "stroke width is not a token");

    // R11: the target and control sizes, and measures in ch.
    if (/(?<![\d.])(44|48)px/.test(stripVars(value)))
        fail("R11", "44px or 48px (use --target or --control-h)");
    if (
        /^(width|min-width|max-width|inline-size|min-inline-size|max-inline-size)$/.test(
            prop,
        ) &&
        /\dch(?![\w-])/.test(stripVars(value))
    )
        fail("R11", "a ch measure (use --measure-*)");

    // R12: lengths in spacing, sizing, offsets, shapes and filters.
    if (!decl.paper) {
        const literal = R12_PROPERTY.test(prop)
            ? [...lengths(value), ...factors(value)]
            : /^(backdrop-)?filter$/.test(prop)
              ? [
                    ...value.matchAll(
                        /(?:blur|drop-shadow)\(([^()]*(?:\([^()]*\))*)\)/g,
                    ),
                ].flatMap(([, args]) => [...lengths(args), ...factors(args)])
              : [];
        if (literal.length) fail("R12", `length literal ${literal.join(" ")}`);
    }
    return out;
}

/** tokens.css holds the tokens only: custom properties (and
 *  color-scheme) on the root or a theme, in @layer and @media blocks. */
function tokensFileFailures(): Failure[] {
    const out: Failure[] = [];
    const allowedSelector = new Set([
        ":root",
        "[data-theme]",
        '[data-theme="void"]',
        '[data-theme="manual"]',
    ]);
    ROOTS.get(TOKENS_FILE)!.walk((node) => {
        if (node.type === "atrule" && !["layer", "media"].includes(node.name))
            out.push(
                sourceFailure(
                    "TOK",
                    TOKENS_FILE,
                    node.source?.start?.line ?? 0,
                    `@${node.name}`,
                    "only @layer and @media",
                ),
            );
        if (
            node.type === "rule" &&
            !node.selectors.every((sel) => allowedSelector.has(collapse(sel)))
        )
            out.push(
                sourceFailure(
                    "TOK",
                    TOKENS_FILE,
                    node.source?.start?.line ?? 0,
                    collapse(node.selector),
                    "only :root and [data-theme] rules",
                ),
            );
    });
    for (const decl of DECLS) {
        if (decl.file !== TOKENS_FILE) continue;
        if (!decl.property.startsWith("--") && decl.property !== "color-scheme")
            out.push(declFailure(decl, "TOK", "only custom properties"));
        for (const name of varNames(decl.value)) {
            if (!TOKENS.has(name) && !RUNTIME.has(name))
                out.push(declFailure(decl, "R13", `reads ${name}`));
        }
    }
    return out;
}

const TAILWIND_RESETS = new Set([
    "--color-*",
    "--font-*",
    "--text-*",
    "--leading-*",
    "--tracking-*",
    "--font-weight-*",
    "--radius-*",
    "--shadow-*",
    "--inset-shadow-*",
    "--drop-shadow-*",
    "--text-shadow-*",
    "--ease-*",
    "--animate-*",
    "--breakpoint-*",
]);

/** The colour roles Tailwind may map: tokens.css's roles, and the two
 *  ladder steps components may read. */
function colourRoles(): Set<string> {
    const roles = new Set(["--bg", "--focus"]);
    for (const decl of DECLS) {
        if (
            decl.file === TOKENS_FILE &&
            decl.selector === ":root, [data-theme]" &&
            decl.context === "" &&
            decl.property.startsWith("--")
        )
            roles.add(decl.property);
    }
    return roles;
}

/** R16: Tailwind's @theme blocks hold a fixed set of names. */
function themeFailures(): Failure[] {
    const out: Failure[] = [];
    const roles = colourRoles();
    for (const decl of DECLS) {
        if (!decl.theme) continue;
        const inline = decl.context.startsWith("@theme inline");
        const { property: prop, value } = decl;
        let ok: boolean;
        if (inline) {
            const colour = /^--color-([\w-]+)$/.exec(prop);
            ok = colour
                ? value === `var(--${colour[1]})` && roles.has(`--${colour[1]}`)
                : /^--font-(sans|serif)$/.test(prop) &&
                  /^var\(--font-[\w-]+\)$/.test(value);
        } else {
            const breakpoint = /^--breakpoint-(sm|md|lg)$/.exec(prop);
            ok = breakpoint
                ? value ===
                  `${BREAKPOINTS[breakpoint[1] as "sm" | "md" | "lg"]}rem`
                : TAILWIND_RESETS.has(prop) && value === "initial";
        }
        if (!ok)
            out.push(declFailure(decl, "R16", "not one of @theme's names"));
    }
    return out;
}

/** R14: every width and height a media query names is lib/breakpoints.ts's. */
function mediaFailures(): Failure[] {
    const out: Failure[] = [];
    const min = new Set(Object.values(BREAKPOINTS).map(String));
    const max = new Set(
        Object.values(BREAKPOINTS).map((v) =>
            String(Math.round((v - 0.01) * 100) / 100),
        ),
    );
    const heights = new Set(Object.values(HEIGHTS).map(String));
    for (const [file, root] of ROOTS) {
        root.walkAtRules("media", (node) => {
            const params = collapse(node.params);
            const bad: string[] = [];
            for (const [feature, side, axis, raw] of params.matchAll(
                /\(\s*(min-|max-)?(width|height)\s*:\s*([^)]*)\)/g,
            )) {
                const value = /^(\d+(?:\.\d+)?)rem$/.exec(raw.trim());
                const n = value ? String(Number(value[1])) : null;
                const ok =
                    n !== null &&
                    (axis === "width"
                        ? side === "min-"
                            ? min.has(n)
                            : side === "max-" && max.has(n)
                        : side !== undefined && heights.has(n));
                if (!ok) bad.push(feature);
            }
            if (/\(\s*[\w-]*(width|height)\s*[<>=]/.test(params))
                bad.push("range syntax");
            if (bad.length)
                out.push({
                    rule: "R14",
                    file,
                    line: node.source?.start?.line ?? 0,
                    context: chainOf(node).join(" > "),
                    selector: "@media",
                    property: params,
                    value: "",
                    why: `not a breakpoint: ${bad.join(", ")}`,
                });
        });
    }
    return out;
}

/** R15: a hover sits under @media (hover: hover). */
function hoverFailures(): Failure[] {
    const out: Failure[] = [];
    for (const [file, root] of ROOTS) {
        root.walkRules((node) => {
            if (!node.selector.includes(":hover")) return;
            const chain = chainOf(node);
            if (chain.some((at) => at.includes("(hover: hover)"))) return;
            const context = chain.join(" > ");
            const selector = collapse(node.selector);
            out.push({
                rule: "R15",
                file,
                line: node.source?.start?.line ?? 0,
                context,
                selector,
                property: ":hover",
                value: "",
                why: "a :hover outside @media (hover: hover)",
            });
        });
    }
    return out;
}

/** Where a global class first appears. */
interface ClassSite {
    file: string;
    line: number;
    context: string;
    selector: string;
}

/** The global classes of styles/*.css, outside paper. */
function globalClasses(): Map<string, ClassSite> {
    const classes = new Map<string, ClassSite>();
    for (const [file, root] of ROOTS) {
        if (!file.startsWith("styles/")) continue;
        root.walkRules((node) => {
            if (
                chainOf(node).some(
                    (at) => at.startsWith("@media") && /\bprint\b/.test(at),
                )
            )
                return;
            const selector = node.selector
                .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, "")
                .replace(/\[[^\]]*\]/g, "");
            for (const [, name] of selector.matchAll(
                /\.(-?[_a-zA-Z][\w-]*)/g,
            )) {
                if (!classes.has(name))
                    classes.set(name, {
                        file,
                        line: node.source?.start?.line ?? 0,
                        context: chainOf(node).join(" > "),
                        selector: collapse(node.selector),
                    });
            }
        });
    }
    return classes;
}

/** G1: the global classes Tailwind also generates a utility for. */
async function tailwindCollisions(): Promise<Map<string, ClassSite>> {
    const classes = globalClasses();
    const css = `@import "tailwindcss" source(none);\n@source inline("${[
        ...classes.keys(),
    ].join(" ")}");\n`;
    const result = await postcss([tailwind({ base: ROOT })]).process(css, {
        from: path.join(ROOT, "tests/lib/design-system.tailwind.css"),
    });
    const generated = new Set<string>();
    postcss.parse(result.css).walkRules((node) => {
        for (const [, name] of node.selector.matchAll(/\.((?:\\.|[\w-])+)/g))
            generated.add(name.replace(/\\(.)/g, "$1"));
    });
    return new Map([...classes].filter(([name]) => generated.has(name)));
}

// ---- TypeScript ---------------------------------------------------------

const sourceOf = (file: string) =>
    ts.createSourceFile(
        file,
        read(file),
        ts.ScriptTarget.Latest,
        true,
        file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
const SOURCE_FILES = new Map(SOURCES.map((file) => [file, sourceOf(file)]));

function visit(node: ts.Node, fn: (node: ts.Node) => void) {
    fn(node);
    node.forEachChild((child) => visit(child, fn));
}

const lineOf = (source: ts.SourceFile, node: ts.Node) =>
    source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

function unwrap(node: ts.Expression): ts.Expression {
    while (
        ts.isParenthesizedExpression(node) ||
        ts.isAsExpression(node) ||
        ts.isSatisfiesExpression(node) ||
        ts.isNonNullExpression(node)
    )
        node = node.expression;
    return node;
}

/** The text of a string-like literal, else null. */
function literalText(node: ts.Node): string | null {
    if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)
    )
        return node.text;
    return null;
}

/** The CSS Modules a source imports, by local name. */
function moduleImports(file: string, source: ts.SourceFile) {
    const map = new Map<string, string>();
    for (const statement of source.statements) {
        if (
            !ts.isImportDeclaration(statement) ||
            !ts.isStringLiteral(statement.moduleSpecifier) ||
            !statement.moduleSpecifier.text.endsWith(".module.css") ||
            !statement.importClause?.name
        )
            continue;
        const spec = statement.moduleSpecifier.text;
        const resolved = spec.startsWith("@/")
            ? spec.slice(2)
            : path.posix.join(path.posix.dirname(file), spec);
        map.set(statement.importClause.name.text, resolved);
    }
    return map;
}

/** The last compound of each selector in a list. */
function subjects(selector: string): string[] {
    const out: string[] = [];
    for (const one of postcss.rule({ selector }).selectors) {
        let depth = 0;
        let start = 0;
        for (let i = 0; i < one.length; i++) {
            const c = one[i];
            if (c === "(") depth++;
            else if (c === ")") depth--;
            else if (depth === 0 && /[\s>+~]/.test(c)) start = i + 1;
        }
        out.push(one.slice(start));
    }
    return out;
}

const TYPE_OR_COLOUR =
    /^(font|font-.+|line-height|letter-spacing|text-transform|color|text-wrap)$/;

/** Whether a module's rules for `.key` set type or colour. */
function setsTypeOrColour(module: string, key: string): boolean {
    const root =
        ROOTS.get(module) ?? postcss.parse(read(module), { from: module });
    const own = new RegExp(`\\.${key}(?![\\w-])`);
    let found = false;
    root.walkRules((node) => {
        if (
            !subjects(node.selector).some(
                (subject) => own.test(subject) && !subject.includes("::"),
            )
        )
            return;
        node.each((child) => {
            if (child.type === "decl" && TYPE_OR_COLOUR.test(child.prop))
                found = true;
        });
    });
    return found;
}

/** T1: the global role classes never sit on an element whose module
 *  class sets type or colour (modules are unlayered and win). */
function pairingFailures(): Failure[] {
    const out: Failure[] = [];
    for (const [file, source] of SOURCE_FILES) {
        const modules = moduleImports(file, source);
        if (!modules.size) continue;
        visit(source, (node) => {
            if (
                !ts.isJsxAttribute(node) ||
                node.name.getText(source) !== "className" ||
                !node.initializer
            )
                return;
            const words = new Set<string>();
            const keys: [string, string][] = [];
            visit(node.initializer, (inner) => {
                const text = literalText(inner);
                if (text !== null)
                    for (const word of text.split(/\s+/)) words.add(word);
                if (
                    ts.isPropertyAccessExpression(inner) &&
                    ts.isIdentifier(inner.expression) &&
                    modules.has(inner.expression.text)
                )
                    keys.push([
                        modules.get(inner.expression.text)!,
                        inner.name.text,
                    ]);
            });
            for (const role of ["label", "data"]) {
                if (!words.has(role)) continue;
                for (const [module, key] of keys) {
                    if (setsTypeOrColour(module, key))
                        out.push(
                            sourceFailure(
                                "T1",
                                file,
                                lineOf(source, node),
                                `${role}+styles.${key}`,
                                `.${role} beside a module class that sets type or colour`,
                            ),
                        );
                }
            }
        });
    }
    return out;
}

/** The share card's markup, which Satori draws into an image from
 *  inline styles: it loads no stylesheet (its colours are T4's). */
const SATORI = new Set(["lib/og-card.tsx"]);

/** T2: a style prop sets component properties only. */
function styleFailures(): Failure[] {
    const out: Failure[] = [];
    for (const [file, source] of SOURCE_FILES) {
        if (SATORI.has(file)) continue;
        const consts = new Map<string, ts.Expression>();
        visit(source, (node) => {
            if (
                ts.isVariableDeclaration(node) &&
                ts.isIdentifier(node.name) &&
                node.initializer &&
                ts.isVariableDeclarationList(node.parent) &&
                node.parent.flags & ts.NodeFlags.Const
            )
                consts.set(node.name.text, node.initializer);
        });
        visit(source, (node) => {
            if (
                !ts.isJsxAttribute(node) ||
                node.name.getText(source) !== "style" ||
                !node.initializer ||
                !ts.isJsxExpression(node.initializer) ||
                !node.initializer.expression
            )
                return;
            let expression = unwrap(node.initializer.expression);
            if (ts.isIdentifier(expression) && consts.has(expression.text))
                expression = unwrap(consts.get(expression.text)!);
            const fail = (snippet: string, why: string) =>
                out.push(
                    sourceFailure(
                        "T2",
                        file,
                        lineOf(source, node),
                        snippet,
                        why,
                    ),
                );
            if (!ts.isObjectLiteralExpression(expression)) {
                fail(
                    collapse(node.initializer.expression.getText(source)).slice(
                        0,
                        60,
                    ),
                    "a style that is not an object of custom properties",
                );
                return;
            }
            const check = (object: ts.ObjectLiteralExpression) => {
                for (const property of object.properties) {
                    // A spread of objects of custom properties, kept or
                    // left out by a condition.
                    if (ts.isSpreadAssignment(property)) {
                        const spread = unwrap(property.expression);
                        const branches = ts.isConditionalExpression(spread)
                            ? [spread.whenTrue, spread.whenFalse].map(unwrap)
                            : [spread];
                        if (branches.every(ts.isObjectLiteralExpression)) {
                            branches.forEach(check);
                            continue;
                        }
                    }
                    const name =
                        ts.isPropertyAssignment(property) &&
                        (ts.isStringLiteral(property.name) ||
                            ts.isIdentifier(property.name))
                            ? property.name.text
                            : collapse(property.getText(source)).slice(0, 60);
                    if (!name.startsWith("--"))
                        fail(name, "a style key that is not a custom property");
                    else if (!componentFiles(name).includes(file))
                        fail(
                            name,
                            `${name} is not a component property of this file`,
                        );
                }
            };
            check(expression);
        });
    }
    return out;
}

/** T3: TypeScript names no breakpoint of its own. */
function breakpointFailures(): Failure[] {
    const out: Failure[] = [];
    const values = new Set<number>(Object.values(BREAKPOINTS));
    for (const [file, source] of SOURCE_FILES) {
        if (file === "lib/breakpoints.ts") continue;
        visit(source, (node) => {
            const text = literalText(node);
            if (text !== null) {
                for (const [query] of text.matchAll(
                    /\((min|max)-(width|height):\s*[\d.]+rem\)/g,
                ))
                    out.push(
                        sourceFailure(
                            "T3",
                            file,
                            lineOf(source, node),
                            query,
                            "a media query written out (read lib/breakpoints.ts)",
                        ),
                    );
            }
            if (
                ts.isBinaryExpression(node) &&
                node.operatorToken.kind === ts.SyntaxKind.AsteriskToken
            ) {
                const sides = [node.left, node.right];
                const number = sides.find(ts.isNumericLiteral);
                const rem = sides.find(
                    (side) => ts.isIdentifier(side) && /rem$/i.test(side.text),
                );
                if (number && rem && values.has(Number(number.text)))
                    out.push(
                        sourceFailure(
                            "T3",
                            file,
                            lineOf(source, node),
                            collapse(node.getText(source)),
                            "a breakpoint written out (read lib/breakpoints.ts)",
                        ),
                    );
            }
        });
    }
    return out;
}

/** The palette's colours, from tokens.css. */
function paletteHexes(): Set<string> {
    const out = new Set<string>();
    for (const [name, values] of TOKENS) {
        if (!/^--(void|manual)-/.test(name)) continue;
        for (const value of values)
            for (const [hex] of value.matchAll(HEX)) out.add(expandHex(hex));
    }
    return out;
}

function expandHex(hex: string): string {
    const h = hex.toLowerCase().slice(1);
    return h.length === 3 || h.length === 4
        ? `#${[...h].map((c) => c + c).join("")}`
        : `#${h}`;
}

/** The copies of the palette outside CSS. */
const PALETTE_COPIES = [
    "lib/og-card.tsx",
    "public/feed.xsl",
    "lib/theme-boot.ts",
    "scripts/generate-patch.mjs",
    "lib/patch.json",
];
const lineAt = (text: string, index: number) =>
    text.slice(0, index).split("\n").length;

/** T4: colours outside CSS are the palette's, or listed scene art. */
function colourCopyFailures(): {
    failures: Failure[];
    scene: Map<string, Set<string>>;
    masks: Map<string, Set<string>>;
} {
    const failures: Failure[] = [];
    const palette = paletteHexes();
    const masks = new Map<string, Set<string>>();
    for (const file of PALETTE_COPIES) {
        const text = read(file);
        const spans = [...text.matchAll(/<mask\b[\s\S]*?<\/mask>/g)].map(
            (m) => [m.index, m.index + m[0].length],
        );
        for (const match of text.matchAll(HEX)) {
            const inMask = spans.some(
                ([start, end]) => match.index >= start && match.index < end,
            );
            if (inMask && (MASK_COLOURS[file] ?? []).includes(match[0])) {
                if (!masks.has(file)) masks.set(file, new Set());
                masks.get(file)!.add(match[0]);
                continue;
            }
            if (!palette.has(expandHex(match[0])))
                failures.push(
                    sourceFailure(
                        "T4",
                        file,
                        lineAt(text, match.index),
                        match[0],
                        "a copy of the palette that is not the palette",
                    ),
                );
        }
    }
    const scene = new Map<string, Set<string>>();
    for (const [file, source] of SOURCE_FILES) {
        if (PALETTE_COPIES.includes(file)) continue;
        if (!file.startsWith("components/") && !file.startsWith("lib/"))
            continue;
        const found: [string, ts.Node][] = [];
        visit(source, (node) => {
            if (
                ts.isCallExpression(node) &&
                ts.isIdentifier(node.expression) &&
                node.expression.text === "token" &&
                node.arguments.length === 2
            ) {
                const fallback = literalText(node.arguments[1]);
                if (fallback !== null && !palette.has(expandHex(fallback)))
                    failures.push(
                        sourceFailure(
                            "T4",
                            file,
                            lineOf(source, node),
                            fallback,
                            "a token() fallback that is not the palette",
                        ),
                    );
                return;
            }
            if (
                ts.isNewExpression(node) &&
                node.expression.getText(source) === "Color" &&
                node.arguments?.length &&
                node.arguments.every(ts.isNumericLiteral)
            )
                found.push([
                    node.arguments.map((a) => a.getText(source)).join(", "),
                    node,
                ]);
            const text = literalText(node);
            if (text === null) return;
            if (
                ts.isCallExpression(node.parent) &&
                ts.isIdentifier(node.parent.expression) &&
                node.parent.expression.text === "token"
            )
                return;
            for (const [hex] of text.matchAll(HEX)) found.push([hex, node]);
            for (const [fn] of text.matchAll(
                /(?:rgba?|hsla?)\(\s*[\d.]+[^)]*\)/g,
            ))
                found.push([fn, node]);
        });
        for (const [colour, node] of found) {
            if ((SCENE_COLOURS[file] ?? []).includes(colour)) {
                if (!scene.has(file)) scene.set(file, new Set());
                scene.get(file)!.add(colour);
                continue;
            }
            failures.push(
                sourceFailure(
                    "T4",
                    file,
                    lineOf(source, node),
                    colour,
                    "a colour outside CSS that is neither the palette nor listed scene art",
                ),
            );
        }
    }
    // The static stars' alphas are the starfield's.
    const look = read("components/sky/starfield.tsx");
    const alpha = (magnitude: number) =>
        new RegExp(`${magnitude}: \\{ r: [\\d.]+, alpha: ([\\d.]+) \\}`).exec(
            look,
        )?.[1];
    for (const [magnitude, name] of [
        [1, "--star-alpha-bright"],
        [2, "--star-alpha-mid"],
        [3, "--star-alpha-faint"],
    ] as const) {
        const token = TOKENS.get(name)?.[0];
        if (token === undefined || Number(token) !== Number(alpha(magnitude)))
            failures.push(
                sourceFailure(
                    "T4",
                    TOKENS_FILE,
                    0,
                    name,
                    "the static stars' alpha differs from starfield.tsx's LOOK",
                ),
            );
    }
    return { failures, scene, masks };
}

// ---- the run ----------------------------------------------------------

let failures: Failure[] = [];
let collisions = new Map<string, ClassSite>();
let scene = new Map<string, Set<string>>();
let masks = new Map<string, Set<string>>();
const excused = new Set<number>();

const allowanceMatches = (failure: Failure, i: number) => {
    const a = ALLOWANCES[i];
    return (
        a.file === failure.file &&
        a.context === failure.context &&
        a.selector === failure.selector &&
        a.property === failure.property &&
        a.value === failure.value
    );
};

beforeAll(async () => {
    const declarations = DECLS.filter(
        (decl) => decl.file !== TOKENS_FILE && !decl.theme,
    ).flatMap(declarationFailures);
    const copies = colourCopyFailures();
    scene = copies.scene;
    masks = copies.masks;
    collisions = await tailwindCollisions();
    const all = [
        ...tokensFileFailures(),
        ...declarations,
        ...themeFailures(),
        ...mediaFailures(),
        ...hoverFailures(),
        ...[...collisions]
            .filter(([name]) => !Object.hasOwn(TAILWIND_COLLISIONS, name))
            .map(([name, { file, line, context, selector }]): Failure => ({
                rule: "G1",
                file,
                line,
                context,
                selector,
                property: `.${name}`,
                value: "",
                why: "a global class that is also a Tailwind utility",
            })),
        ...pairingFailures(),
        ...styleFailures(),
        ...breakpointFailures(),
        ...copies.failures,
    ];
    failures = all.filter((failure) => {
        const i = ALLOWANCES.findIndex((_, j) => allowanceMatches(failure, j));
        if (i === -1) return true;
        excused.add(i);
        return false;
    });
}, 60_000);

const describeFailure = (f: Failure) =>
    `${f.rule} ${f.file}:${f.line} ${[f.context, f.selector]
        .filter(Boolean)
        .join(
            " > ",
        )} { ${f.property}${f.value ? `: ${f.value}` : ""} }: ${f.why}`;

describe("the design system", () => {
    it("refuses everything the allow-list does not excuse", () => {
        expect(failures.map(describeFailure)).toEqual([]);
    });

    it("allows nothing stale", () => {
        const stale: string[] = [];
        ALLOWANCES.forEach((a, i) => {
            if (!excused.has(i))
                stale.push(
                    `ALLOWANCES ${a.file} ${a.context} ${a.selector} { ${a.property}: ${a.value} } excuses nothing`,
                );
        });
        for (const [name, { files }] of Object.entries(COMPONENT_PROPERTIES)) {
            for (const file of files) {
                const text = read(file);
                const quoted = new RegExp(`["'\`]${name}["'\`]`);
                const used = file.endsWith(".css")
                    ? DECLS.some(
                          (d) =>
                              d.file === file &&
                              (d.property === name ||
                                  varNames(d.value).includes(name)),
                      ) ||
                      (ROOTS.has(file) &&
                          new RegExp(`@property ${name}(?![\\w-])`).test(text))
                    : quoted.test(text) || text.includes(`var(${name}`);
                if (!used)
                    stale.push(
                        `COMPONENT_PROPERTIES ${name}: ${file} neither declares nor reads it`,
                    );
            }
        }
        for (const [file, list] of Object.entries(SCENE_COLOURS))
            for (const colour of list)
                if (!scene.get(file)?.has(colour))
                    stale.push(`SCENE_COLOURS ${file}: ${colour} is not there`);
        for (const [file, list] of Object.entries(MASK_COLOURS))
            for (const colour of list)
                if (!masks.get(file)?.has(colour))
                    stale.push(
                        `MASK_COLOURS ${file}: ${colour} is not in a mask`,
                    );
        for (const name of Object.keys(TAILWIND_COLLISIONS))
            if (!collisions.has(name))
                stale.push(`TAILWIND_COLLISIONS .${name} no longer collides`);
        for (const name of RUNTIME_PROPERTIES)
            if (!DECLS.some((d) => varNames(d.value).includes(name)))
                stale.push(`RUNTIME_PROPERTIES ${name} is read nowhere`);
        expect(stale).toEqual([]);
    });

    it("reads every breakpoint lib/breakpoints.ts names", () => {
        const used = new Set<number>();
        for (const root of ROOTS.values())
            root.walkAtRules("media", (node) => {
                for (const [, raw] of node.params.matchAll(
                    /(?:min|max)-(?:width|height)\s*:\s*([\d.]+)rem/g,
                ))
                    used.add(Number(raw));
            });
        const unused = Object.entries({ ...BREAKPOINTS, ...HEIGHTS })
            .filter(
                ([, value]) =>
                    !used.has(value) &&
                    !used.has(Math.round((value - 0.01) * 100) / 100),
            )
            .map(([name]) => name);
        expect(unused).toEqual([]);
    });
});
