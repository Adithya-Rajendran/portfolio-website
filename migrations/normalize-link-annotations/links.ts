/**
 * Finds legacy `link` annotations in a Portable Text body. Both the legacy
 * `link` markDef and the Studio's `contentLink` have the shape `{ href }`
 * (sanity/schemas/objects/contentLink.ts), so normalising one only changes
 * its `_type`: the `_key` that spans point at, the `href` and any other
 * field stay as they are. Pure, so the tests exercise it without a dataset.
 */

/** A path into a document, as `sanity/migrate` patches take it. */
export type PathSegment = string | number | { _key: string };

export type LegacyLinkFix = {
    /** Where the markDef sits, e.g. `body[_key=="a"].markDefs[_key=="b"]`. */
    path: PathSegment[];
    /** The markDef as it should read afterwards. */
    markDef: Record<string, unknown>;
};

/** The document fields that hold Portable Text (post and project essays). */
export const PORTABLE_TEXT_FIELDS = ["body"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function itemSegment(item: unknown, index: number): PathSegment {
    return isRecord(item) && typeof item._key === "string" && item._key
        ? { _key: item._key }
        : index;
}

function visit(value: unknown, path: PathSegment[], fixes: LegacyLinkFix[]) {
    if (Array.isArray(value)) {
        value.forEach((item, index) =>
            visit(item, [...path, itemSegment(item, index)], fixes),
        );
        return;
    }
    if (!isRecord(value)) return;

    // A block's annotations live in `markDefs`; callouts nest whole blocks
    // in their own `body`, so every object is searched, not just the top.
    if (Array.isArray(value.markDefs)) {
        value.markDefs.forEach((markDef, index) => {
            if (isRecord(markDef) && markDef._type === "link") {
                fixes.push({
                    path: [...path, "markDefs", itemSegment(markDef, index)],
                    markDef: { ...markDef, _type: "contentLink" },
                });
            }
        });
    }
    for (const [key, child] of Object.entries(value)) {
        if (key === "markDefs") continue;
        if (Array.isArray(child) || isRecord(child)) {
            visit(child, [...path, key], fixes);
        }
    }
}

/**
 * Every legacy `link` markDef in the document's Portable Text fields, with
 * the value that replaces it. Empty when there is nothing to change, which
 * is what makes the migration safe to run again.
 */
export function findLegacyLinks(
    document: Record<string, unknown>,
): LegacyLinkFix[] {
    const fixes: LegacyLinkFix[] = [];
    for (const field of PORTABLE_TEXT_FIELDS) {
        visit(document[field], [field], fixes);
    }
    return fixes;
}
