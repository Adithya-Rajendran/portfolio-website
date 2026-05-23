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
        block: "mb-3 text-slate-600 dark:text-slate-300",
        strong: "font-semibold",
        highlight: "font-medium",
    },
    homeBio: {
        block: "text-lg leading-relaxed text-slate-600 dark:text-slate-400 text-center",
        strong: "font-semibold",
        highlight: "font-semibold",
    },
};

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
                    className={`${v.highlight} text-emerald-700 dark:text-emerald-400`}
                >
                    {children}
                </span>
            ),
            highlightTeal: ({ children }) => (
                <span
                    className={`${v.highlight} text-teal-700 dark:text-cyan-400`}
                >
                    {children}
                </span>
            ),
            highlightOrange: ({ children }) => (
                <span
                    className={`${v.highlight} text-orange-700 dark:text-orange-500`}
                >
                    {children}
                </span>
            ),
            link: ({ children, value }) => (
                <a
                    href={value?.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 hover:underline dark:text-emerald-400"
                >
                    {children}
                </a>
            ),
        },
    };
}
