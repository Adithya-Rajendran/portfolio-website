/**
 * Shared utility functions for blog components.
 * Consolidates duplicated helpers that were previously scattered
 * across featured.tsx, latest.tsx, blog-post-content.tsx, and
 * portable-text-components.tsx.
 */

/** Format a date string like "2026-03-06" → "March 6, 2026" */
export function formatDate(dateStr?: string): string {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });
}

/** Convert heading text to a URL-friendly slug */
export function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
}

/** Extract raw text from React children (for heading slugification) */
export function extractText(children: React.ReactNode): string {
    if (typeof children === "string") return children;
    if (Array.isArray(children)) return children.map(extractText).join("");
    if (children && typeof children === "object" && "props" in children) {
        return extractText((children as any).props.children);
    }
    return "";
}

/** Shared Tailwind class strings for consistent card styling */
export const cardClasses = {
    base: "group relative rounded-xl overflow-hidden border border-white/8 bg-white/[0.03] transition-all duration-300 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 block",
    imageHover:
        "w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]",
    sectionLabel:
        "text-sm font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-6",
} as const;
