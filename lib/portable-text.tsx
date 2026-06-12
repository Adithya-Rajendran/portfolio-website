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
        block: "text-lg leading-relaxed text-slate-700 dark:text-slate-300 text-center",
        strong: "font-semibold",
        highlight: "font-semibold",
    },
};

/**
 * highlightEmerald/highlightTeal/highlightOrange are frozen Sanity mark
 * names — a content contract with existing CMS documents, so they must
 * not be renamed here. They map onto the three theme positions
 * (c1 via text-accent, c2, c3) so existing posts adapt to whichever
 * accent theme the visitor has selected.
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
                <span className={`${v.highlight} text-accent`}>{children}</span>
            ),
            highlightTeal: ({ children }) => (
                <span className={`${v.highlight} text-c2`}>{children}</span>
            ),
            highlightOrange: ({ children }) => (
                <span className={`${v.highlight} text-c3`}>{children}</span>
            ),
            link: ({ children, value }) => (
                <a
                    href={value?.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                >
                    {children}
                </a>
            ),
        },
    };
}
