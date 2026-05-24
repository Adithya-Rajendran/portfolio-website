/**
 * Shared utility functions for blog components.
 * Consolidates duplicated helpers that were previously scattered
 * across featured.tsx, latest.tsx, blog-post-content.tsx, and
 * portable-text-components.tsx.
 */

import type { Post } from "@/sanity.types";

/** Format a date string like "2026-03-06" → "March 6, 2026" */
export function formatDate(dateStr?: string): string {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });
}

type PostBodyBlock = Extract<
    NonNullable<Post["body"]>[number],
    { _type: "block" }
>;

function isBodyBlock(
    block: NonNullable<Post["body"]>[number],
): block is PostBodyBlock {
    return block._type === "block";
}

/** Flatten all text spans in a Sanity post body into a single string */
export function extractBodyText(post: Pick<Post, "body">): string {
    return post.body
        ? post.body
              .filter(isBodyBlock)
              .map((block) =>
                  block.children?.map((child) => child.text || "").join(" "),
              )
              .join(" ")
        : "";
}

/** Words-per-minute estimate; min 1 minute. */
export function estimateReadingTime(text: string): number {
    const wordsPerMinute = 200;
    const words = text.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / wordsPerMinute));
}

/** Convenience: reading time for a post (extracts text, then estimates). */
export function readingTimeFor(post: Pick<Post, "body">): number {
    return estimateReadingTime(extractBodyText(post));
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
        const props = (children as { props?: { children?: React.ReactNode } })
            .props;
        return extractText(props?.children);
    }
    return "";
}
