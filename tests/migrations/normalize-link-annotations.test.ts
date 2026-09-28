import { describe, expect, it } from "vitest";
import {
    collectMigrationMutations,
    type MigrationContext,
} from "sanity/migrate";
import migration from "@/migrations/normalize-link-annotations";
import {
    findLegacyLinks,
    type PathSegment,
} from "@/migrations/normalize-link-annotations/links";

type Doc = {
    _id: string;
    _type: string;
    _rev?: string;
    [key: string]: unknown;
};

function paragraph(
    key: string,
    markDefs: Record<string, unknown>[],
    text = "Read the post",
) {
    return {
        _key: key,
        _type: "block",
        style: "normal",
        markDefs,
        children: [
            {
                _key: `${key}-span`,
                _type: "span",
                text,
                marks: markDefs.map((markDef) => markDef._key),
            },
        ],
    };
}

/** A post shaped like `my-homelab`: one legacy link, plus one in a callout. */
const legacyPost: Doc = {
    _id: "post-legacy",
    _type: "post",
    _rev: "rev-1",
    title: "A post with legacy links",
    body: [
        paragraph("intro", [
            {
                _key: "dgx",
                _type: "link",
                href: "/blog/kubernetes-on-the-nvidia-dgx-spark",
            },
        ]),
        {
            _key: "note",
            _type: "callout",
            tone: "note",
            body: [
                paragraph("note-text", [
                    {
                        _key: "docs",
                        _type: "link",
                        href: "https://example.com/docs",
                    },
                    {
                        _key: "kept",
                        _type: "contentLink",
                        href: "https://example.com/kept",
                    },
                ]),
            ],
        },
    ],
};

const modernProject: Doc = {
    _id: "drafts.project-modern",
    _type: "project",
    _rev: "rev-2",
    body: [
        paragraph("only", [
            { _key: "site", _type: "contentLink", href: "/portfolio" },
        ]),
    ],
};

const context = { dryRun: true } as unknown as MigrationContext;

async function runMigration(documents: Doc[]) {
    const batches: unknown[] = [];
    const iterate = async function* () {
        for (const document of documents) yield document;
    };
    for await (const batch of collectMigrationMutations(
        migration,
        iterate as Parameters<typeof collectMigrationMutations>[1],
        context,
    )) {
        batches.push(batch);
    }
    return batches.flat() as {
        id: string;
        type: string;
        options?: { ifRevision?: string };
        patches: {
            path: PathSegment[];
            op: { type: string; value: unknown };
        }[];
    }[];
}

/** Applies the fixes the way the patch sets them, for the re-run check. */
function applyFixes(document: Doc) {
    const copy = structuredClone(document);
    for (const { path, markDef } of findLegacyLinks(copy)) {
        let parent: unknown = copy;
        for (const segment of path.slice(0, -1)) {
            parent = Array.isArray(parent)
                ? typeof segment === "object"
                    ? parent.find((item) => item._key === segment._key)
                    : parent[segment as number]
                : (parent as Record<string, unknown>)[segment as string];
        }
        const last = path[path.length - 1] as { _key: string };
        const items = parent as Record<string, unknown>[];
        items[items.findIndex((item) => item._key === last._key)] = markDef;
    }
    return copy;
}

describe("normalize-link-annotations", () => {
    it("finds legacy links in essays and in callouts, keyed by _key", () => {
        expect(findLegacyLinks(legacyPost)).toEqual([
            {
                path: ["body", { _key: "intro" }, "markDefs", { _key: "dgx" }],
                markDef: {
                    _key: "dgx",
                    _type: "contentLink",
                    href: "/blog/kubernetes-on-the-nvidia-dgx-spark",
                },
            },
            {
                path: [
                    "body",
                    { _key: "note" },
                    "body",
                    { _key: "note-text" },
                    "markDefs",
                    { _key: "docs" },
                ],
                markDef: {
                    _key: "docs",
                    _type: "contentLink",
                    href: "https://example.com/docs",
                },
            },
        ]);
    });

    it("keeps every other field of the annotation", () => {
        const [fix] = findLegacyLinks({
            body: [
                paragraph("p", [
                    {
                        _key: "l",
                        _type: "link",
                        href: "https://example.com",
                        blank: true,
                    },
                ]),
            ],
        });
        expect(fix.markDef).toEqual({
            _key: "l",
            _type: "contentLink",
            href: "https://example.com",
            blank: true,
        });
    });

    it("falls back to array indexes where an item has no _key", () => {
        const [fix] = findLegacyLinks({
            body: [
                {
                    _type: "block",
                    markDefs: [{ _type: "link", href: "/about" }],
                    children: [],
                },
            ],
        });
        expect(fix.path).toEqual(["body", 0, "markDefs", 0]);
    });

    it("ignores links outside the essay and documents without a body", () => {
        expect(
            findLegacyLinks({
                summary: [paragraph("p", [{ _key: "l", _type: "link" }])],
            }),
        ).toEqual([]);
        expect(findLegacyLinks({ _id: "x", _type: "post" })).toEqual([]);
    });

    it("patches only documents with legacy links, at their revision", async () => {
        const mutations = await runMigration([legacyPost, modernProject]);

        expect(mutations).toHaveLength(1);
        const [mutation] = mutations;
        expect(mutation).toMatchObject({
            id: "post-legacy",
            type: "patch",
            options: { ifRevision: "rev-1" },
        });
        expect(
            mutation.patches.map(({ path, op }) => ({
                path,
                type: op.type,
                value: op.value,
            })),
        ).toEqual(
            findLegacyLinks(legacyPost).map(({ path, markDef }) => ({
                path,
                type: "set",
                value: markDef,
            })),
        );
    });

    it("changes nothing on a second run", async () => {
        const migrated = applyFixes(legacyPost);
        expect(findLegacyLinks(migrated)).toEqual([]);
        expect(await runMigration([migrated, modernProject])).toEqual([]);
        // The spans still point at the same annotation keys.
        expect(JSON.stringify(migrated)).toContain('"marks":["dgx"]');
    });

    it("targets posts and projects only", () => {
        expect(migration.documentTypes).toEqual(["post", "project"]);
    });
});
