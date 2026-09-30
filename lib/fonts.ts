import { DM_Mono, Jost, Michroma, Newsreader } from "next/font/google";

/**
 * The four families (plan §2.7), self-hosted by next/font at build time.
 * Their variables go on <html> (app/layout.tsx, app/global-not-found.tsx)
 * and styles/tokens.css builds the font stacks from them. Each variable
 * already carries a metric-matched fallback face (adjustFontFallback).
 *
 * Jost (the name, navigation and every UI label), Newsreader's roman (the
 * long read, whose first paragraph is a post's largest paint) and DM
 * Mono's regular are the preloaded files. Newsreader's italic, DM Mono's
 * medium and Michroma load when text first uses them. Jost's italic is
 * never loaded.
 */
export const jost = Jost({
    subsets: ["latin"],
    variable: "--font-jost",
    display: "swap",
});

// Variable weight only: the default leaves out the optical-size axis, which
// would more than double the file.
export const newsreader = Newsreader({
    subsets: ["latin"],
    variable: "--font-newsreader",
    display: "swap",
});

// The italic is its own family, so it is not preloaded: next/font preloads
// every file of a call. Italic Newsreader text sets
// `font-family: var(--font-long-italic)` (styles/tokens.css) with
// `font-style: italic`.
export const newsreaderItalic = Newsreader({
    subsets: ["latin"],
    style: "italic",
    variable: "--font-newsreader-italic",
    display: "swap",
    preload: false,
});

// The regular is preloaded: its fallback sets lowercase about a fifth
// narrower, so a wrapped mono line in the first viewport (a project's
// stack on a phone) re-wrapped when the face arrived and moved what sits
// under it. The medium (a listing's keywords) is its own call, so it is
// not preloaded; both declare the one "DM Mono" family, and
// `--font-dm-mono` reaches both.
export const dmMono = DM_Mono({
    weight: "400",
    subsets: ["latin"],
    variable: "--font-dm-mono",
    display: "swap",
});

export const dmMonoMedium = DM_Mono({
    weight: "500",
    subsets: ["latin"],
    variable: "--font-dm-mono-medium",
    display: "swap",
    preload: false,
});

export const michroma = Michroma({
    weight: "400",
    subsets: ["latin"],
    variable: "--font-michroma",
    display: "swap",
    preload: false,
});

/** The class names that define every font variable, for <html>. */
export const fontVariables = [
    jost.variable,
    newsreader.variable,
    newsreaderItalic.variable,
    dmMono.variable,
    dmMonoMedium.variable,
    michroma.variable,
].join(" ");
