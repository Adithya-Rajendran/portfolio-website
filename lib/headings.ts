/**
 * Heading ids for Portable Text bodies: the one slug function shared by the
 * post and project pages (anchors, contents) and the Sanity schema, which
 * checks that a 3D-model callout links to a heading that exists. Keep this
 * module free of imports: the Studio bundles it.
 */

/** The fields of a Portable Text block that heading ids are derived from. */
export type HeadingSourceBlock = {
    _key?: string;
    _type: string;
    [key: string]: unknown;
};

type HeadingBlock = HeadingSourceBlock & {
    _key: string;
    _type: "block";
    style: "h2" | "h3" | "h4";
    children?: { text?: string }[];
};

function isHeadingBlock(block: HeadingSourceBlock): block is HeadingBlock {
    const hasValidChildren =
        block.children === undefined ||
        (Array.isArray(block.children) &&
            block.children.every(
                (child) =>
                    !!child &&
                    typeof child === "object" &&
                    ((child as { text?: unknown }).text === undefined ||
                        typeof (child as { text?: unknown }).text === "string"),
            ));

    return (
        block._type === "block" &&
        typeof block._key === "string" &&
        typeof block.style === "string" &&
        ["h2", "h3", "h4"].includes(block.style) &&
        hasValidChildren
    );
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
 * Extract h2–h4 headings from a post or project body. The single source of
 * truth for heading ids: the ToC links, the rendered heading anchors and the
 * Studio's callout-anchor check all consume these entries (via the
 * _key → id map), so they agree by construction.
 */
export function extractHeadings(post: {
    body?: readonly HeadingSourceBlock[] | null;
}): PostHeading[] {
    if (!post.body) return [];

    // Duplicate ids break anchor navigation (getElementById resolves to
    // the first match), so every emitted id must be unique — including
    // against suffixed ids ("Intro", "Intro", "Intro 2" must not both
    // yield "intro-2"). Track the final ids, not just the bases.
    const used = new Set<string>();

    return post.body
        .filter((block): block is HeadingBlock => isHeadingBlock(block))
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
                level: parseInt(block.style.replace("h", ""), 10) as 2 | 3 | 4,
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

/**
 * The headings a post's contents list: its sections (h2). A body with no
 * h2 lists its top level instead, so the contents are never empty while
 * the text has headings.
 */
export function contentsHeadings(
    headings: readonly PostHeading[],
): PostHeading[] {
    const top = Math.min(...headings.map((heading) => heading.level));
    return headings.filter((heading) => heading.level === top);
}
