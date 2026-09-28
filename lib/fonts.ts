import { DM_Mono, Jost, Michroma, Newsreader } from "next/font/google";

/**
 * The four families (plan §2.7), self-hosted by next/font at build time.
 * Their variables go on <html> (app/layout.tsx, app/global-not-found.tsx)
 * and styles/tokens.css builds the font stacks from them. Each variable
 * already carries a metric-matched fallback face (adjustFontFallback).
 *
 * Jost (the name, navigation and every UI label) and Newsreader's roman
 * (the long read, whose first paragraph is a post's largest paint) are the
 * two preloaded files. Newsreader's italic, DM Mono and Michroma load when
 * text first uses them. Jost's italic is never loaded.
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

export const dmMono = DM_Mono({
    weight: ["400", "500"],
    subsets: ["latin"],
    variable: "--font-dm-mono",
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
    michroma.variable,
].join(" ");
