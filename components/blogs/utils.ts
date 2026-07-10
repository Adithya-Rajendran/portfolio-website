/**
 * Shared utility functions for blog components.
 * Consolidates duplicated helpers that were previously scattered
 * across featured.tsx, latest.tsx, blog-post-content.tsx, and
 * portable-text-components.tsx.
 */

import type { Post } from "@/sanity.types";
import { urlForImage } from "@/lib/sanity-image";

/** Format a date string like "2026-03-06" → "March 6, 2026" */
export function formatDate(dateStr?: string): string {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });
}

/** Resolve a post slug whether it's a plain string or a Sanity slug object */
export function getPostSlug(post: {
    slug?: string | { current?: string } | null;
}): string {
    return typeof post.slug === "string"
        ? post.slug
        : (post.slug?.current ?? "");
}

/**
 * Card image dimensions per PostCard variant — the single source of
 * truth shared by post-card.tsx (rendering) and actions/warmCache.ts
 * (CDN pre-warming), so the warmer always primes the exact URLs the
 * cards request.
 */
export const POST_IMAGE_DIMENSIONS = {
    hero: { width: 1200, height: 600 },
    medium: { width: 800, height: 480 },
    side: { width: 600, height: 400 },
    list: { width: 400, height: 240 },
} as const;

/** Cropped, format-negotiated card image URL for a post (null if no image) */
export function getPostImageUrl(
    post: Pick<Post, "image">,
    width: number,
    height: number,
): string | null {
    if (!post.image) return null;
    return urlForImage(post.image)
        .width(width)
        .height(height)
        .fit("crop")
        .auto("format")
        .url();
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

/** Words-per-minute reading estimate from a precomputed word count
 *  (the list GROQ projection ships `wordCount` instead of the body). */
export function readingTimeFromWordCount(wordCount?: number | null): number {
    const wordsPerMinute = 200;
    return Math.max(1, Math.ceil((wordCount ?? 0) / wordsPerMinute));
}

/** Convert heading text to a URL-friendly slug */
function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
}

export interface PostHeading {
    id: string;
    text: string;
    level: 2 | 3 | 4;
    /** Sanity block _key — links each heading back to its source block */
    key: string;
}

/**
 * Extract h2–h4 headings from a post body. The single source of truth for
 * heading ids: the ToC links and the rendered heading anchors both consume
 * these entries (via the _key → id map), so they agree by construction.
 */
export function extractHeadings(post: Pick<Post, "body">): PostHeading[] {
    if (!post.body) return [];

    // Duplicate ids break anchor navigation (getElementById resolves to
    // the first match), so every emitted id must be unique — including
    // against suffixed ids ("Intro", "Intro", "Intro 2" must not both
    // yield "intro-2"). Track the final ids, not just the bases.
    const used = new Set<string>();

    return post.body
        .filter(
            (block): block is PostBodyBlock =>
                isBodyBlock(block) &&
                ["h2", "h3", "h4"].includes(block.style ?? ""),
        )
        .map((block) => {
            const text =
                block.children?.map((child) => child.text || "").join("") || "";
            const base = slugify(text);
            let id = base;
            for (let n = 2; used.has(id); n++) {
                id = `${base}-${n}`;
            }
            used.add(id);
            return {
                id,
                text,
                level: parseInt(block.style!.replace("h", ""), 10) as 2 | 3 | 4,
                key: block._key,
            };
        })
        .filter((h) => h.text.length > 0);
}

/** Map each heading block's _key to its precomputed anchor id */
export function headingIdsByKey(
    headings: PostHeading[],
): Record<string, string> {
    return Object.fromEntries(headings.map((h) => [h.key, h.id]));
}
