import type { PortableTextComponents } from "@portabletext/react";

type Variant = "intro" | "about" | "homeBio";

// Per-variant styling that the three callers care about:
//  - intro renders a single-line headline (inline span, bold marks)
//  - about renders paragraph copy (semibold marks)
//  - homeBio is a centered hero-style paragraph (semibold marks, larger text)
const variants: Record<
    Variant,
    {
        block: string | null;
        strong: string;
        highlight: string;
    }
> = {
    intro: {
        block: null,
        strong: "font-bold",
        highlight: "font-bold",
    },
    about: {
        block: "mb-3 text-slate-700 dark:text-slate-300",
        strong: "font-semibold",
        highlight: "font-medium",
    },
    homeBio: {
        block:
            "text-lg leading-relaxed text-slate-700 dark:text-slate-300 text-center",
        strong: "font-semibold",
        highlight: "font-semibold",
    },
};

/**
 * Highlight marks named after the original "emerald/teal/orange" palette
 * remain in CMS content. They now resolve to the indigo / violet / sky
 * accents of the Surface Glass theme so existing posts keep working.
 */
export function createPortableTextStyles(
    variant: Variant,
): PortableTextComponents {
    const v = variants[variant];

    return {
        block: {
            normal: ({ children }) =>
                v.block === null ? (
                    <span>{children}</span>
                ) : (
                    <p className={v.block}>{children}</p>
                ),
        },
        marks: {
            strong: ({ children }) => (
                <span className={v.strong}>{children}</span>
            ),
            em: ({ children }) => <span className="italic">{children}</span>,
            highlightEmerald: ({ children }) => (
                <span
                    className={`${v.highlight} text-indigo-600 dark:text-indigo-300`}
                >
                    {children}
                </span>
            ),
            highlightTeal: ({ children }) => (
                <span
                    className={`${v.highlight} text-sky-600 dark:text-sky-300`}
                >
                    {children}
                </span>
            ),
            highlightOrange: ({ children }) => (
                <span
                    className={`${v.highlight} text-violet-600 dark:text-violet-300`}
                >
                    {children}
                </span>
            ),
            link: ({ children, value }) => (
                <a
                    href={value?.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline dark:text-indigo-300"
                >
                    {children}
                </a>
            ),
        },
    };
}
