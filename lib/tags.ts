import type { PostListItem } from "@/lib/sanity-client";

/**
 * Pure helpers for the blog tag taxonomy. Tags are plain lowercase
 * slug-safe strings (enforced by the Sanity schema), so a tag value IS
 * its URL segment — no slugification layer between content and routes.
 */

export type TagCount = { tag: string; count: number };

/** Same shape the schema validation enforces; used as a URL-side gate. */
export const TAG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Distinct tags across posts with usage counts, sorted by count desc
 * then alphabetically. Posts without tags simply contribute nothing —
 * every pre-taxonomy post remains valid.
 */
export function collectTags(posts: Pick<PostListItem, "tags">[]): TagCount[] {
    const counts = new Map<string, number>();
    for (const post of posts) {
        for (const tag of post.tags ?? []) {
            if (!TAG_PATTERN.test(tag)) continue;
            counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
    }
    return [...counts.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/**
 * A tag links only once it gathers this many entries: a tag page with one
 * entry would only lead back to the entry in view. Below it the tag is not
 * shown at all (a tag shows only when it links): not on an index row, an
 * entry's head, the chips or the sitemap. Its page still answers.
 */
export const TAG_LINK_MIN = 2;

/** The tags that link (`TAG_LINK_MIN`), in `collectTags` order. */
export function linkedTags(tags: readonly TagCount[]): TagCount[] {
    return tags.filter(({ count }) => count >= TAG_LINK_MIN);
}

/** Tag words the owner writes in capitals. */
const ACRONYMS: Readonly<Record<string, string>> = {
    gpu: "GPU",
    lxd: "LXD",
    ai: "AI",
    nfs: "NFS",
    oidc: "OIDC",
};

/**
 * A tag as words, for its page's h1 and title: hyphens become spaces, in
 * sentence case, acronyms in capitals ("gpu-computing" → "GPU computing",
 * "homelab" → "Homelab"). The slug stays the tag's URL and its chip.
 */
export function tagLabel(tag: string): string {
    const label = tag
        .split("-")
        .map((word) => ACRONYMS[word] ?? word)
        .join(" ");
    return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Posts carrying the exact tag (no fuzzy/prefix matching). */
export function filterPostsByTag<T extends Pick<PostListItem, "tags">>(
    posts: T[],
    tag: string,
): T[] {
    return posts.filter((post) => post.tags?.includes(tag));
}

/**
 * Group posts by publish year, newest year first. Post order within a
 * year is preserved from the input (list queries sort newest-first).
 * Posts with missing/malformed dates land in an "Undated" group at the
 * end rather than disappearing.
 */
export function groupPostsByYear<T extends { publishedAt?: string }>(
    posts: T[],
): { year: string; posts: T[] }[] {
    const groups = new Map<string, T[]>();
    for (const post of posts) {
        const year = /^\d{4}-/.test(post.publishedAt ?? "")
            ? (post.publishedAt ?? "").slice(0, 4)
            : "Undated";
        const group = groups.get(year) ?? [];
        group.push(post);
        groups.set(year, group);
    }
    return [...groups.entries()]
        .map(([year, groupPosts]) => ({ year, posts: groupPosts }))
        .sort((a, b) => {
            if (a.year === "Undated") return 1;
            if (b.year === "Undated") return -1;
            return b.year.localeCompare(a.year);
        });
}
