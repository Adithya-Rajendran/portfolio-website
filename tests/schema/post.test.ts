import { describe, expect, it } from "vitest";
import {
    createSchema,
    defineField,
    defineType,
    validateDocument,
    type SanityDocument,
} from "sanity";
import { checkChangeDate } from "@/lib/post-fields";
import { schemaTypes } from "@/sanity/schemas";

/**
 * The PR 10 rich-text and post additions, validated by Sanity itself
 * against the repository schema: footnotes, image credit / kind / width,
 * the caution callout and the changelog. `code` comes from the
 * @sanity/code-input plugin in the Studio; a stub stands in for it here.
 */
const codeStub = defineType({
    name: "code",
    title: "Code",
    type: "object",
    fields: [
        defineField({ name: "code", type: "text" }),
        defineField({ name: "language", type: "string" }),
        defineField({ name: "filename", type: "string" }),
    ],
});

const schema = createSchema({
    name: "post-test",
    types: [...schemaTypes, codeStub],
});

type ValidationOptions = Parameters<typeof validateDocument>[0];

async function validate(
    document: Record<string, unknown>,
    environment: "cli" | "studio" = "cli",
) {
    const client = {
        // The slug type's own check: `!defined(…)` is true when it is free.
        fetch: async () => true,
        getDataUrl: () => "",
        observable: {},
        withConfig: () => client,
        config: () => ({}),
    };
    const markers = await validateDocument({
        document: document as unknown as SanityDocument,
        workspace: {
            schema,
            getClient: () => client,
        } as unknown as ValidationOptions["workspace"],
        environment,
        getDocumentExists: async () => true,
    });
    return markers
        .filter((marker) => marker.level === "error")
        .map((marker) => ({
            path: JSON.stringify(marker.path),
            message: marker.message,
        }));
}

function paragraph(markDefs: unknown[], marks: string[] = []) {
    return {
        _key: "p1",
        _type: "block",
        style: "normal",
        markDefs,
        children: [{ _key: "s1", _type: "span", text: "Cited text", marks }],
    };
}

function postWith(overrides: Record<string, unknown>) {
    return {
        _id: "drafts.post-test",
        _type: "post",
        title: "A test post",
        slug: { _type: "slug", current: "a-test-post" },
        description: "A test description.",
        publishedAt: "2026-03-01",
        body: [paragraph([])],
        ...overrides,
    };
}

describe("post schema: the long-read additions", () => {
    it("accepts a footnote, an image with credit, kind and width, a caution callout and a changelog", async () => {
        const errors = await validate(
            postWith({
                body: [
                    paragraph(
                        [{ _key: "n1", _type: "footnote", text: "A note." }],
                        ["n1"],
                    ),
                    {
                        _key: "i1",
                        _type: "image",
                        asset: {
                            _type: "reference",
                            _ref: "image-abc123def456-1000x500-png",
                        },
                        alt: "A diagram",
                        credit: "Drawn by the author",
                        kind: "diagram",
                        width: "wide",
                    },
                    {
                        _key: "c1",
                        _type: "callout",
                        tone: "caution",
                        title: "Back up first",
                        body: [paragraph([])],
                    },
                ],
                changelog: [
                    {
                        _key: "r1",
                        _type: "postChange",
                        date: "2026-03-02",
                        kind: "correction",
                        note: "Fixed a path.",
                    },
                ],
            }),
        );
        expect(errors).toEqual([]);
    });

    it("requires a footnote's text and caps it at 400 characters", async () => {
        const empty = await validate(
            postWith({
                body: [paragraph([{ _key: "n1", _type: "footnote" }], ["n1"])],
            }),
        );
        expect(empty.map((error) => error.path)).toEqual([
            JSON.stringify([
                "body",
                { _key: "p1" },
                "markDefs",
                { _key: "n1" },
                "text",
            ]),
        ]);
        const long = await validate(
            postWith({
                body: [
                    paragraph(
                        [
                            {
                                _key: "n1",
                                _type: "footnote",
                                text: "x".repeat(401),
                            },
                        ],
                        ["n1"],
                    ),
                ],
            }),
        );
        expect(long).toHaveLength(1);
    });

    it("refuses an image width or kind outside the lists", async () => {
        const errors = await validate(
            postWith({
                body: [
                    {
                        _key: "i1",
                        _type: "image",
                        asset: {
                            _type: "reference",
                            _ref: "image-abc123def456-1000x500-png",
                        },
                        alt: "An image",
                        kind: "painting",
                        width: "huge",
                    },
                ],
            }),
        );
        expect(errors.map((error) => error.path).sort()).toEqual(
            [
                JSON.stringify(["body", { _key: "i1" }, "kind"]),
                JSON.stringify(["body", { _key: "i1" }, "width"]),
            ].sort(),
        );
    });

    it("requires a change's date, kind and note, and dates it no earlier than the post", async () => {
        const errors = await validate(
            postWith({
                changelog: [
                    { _key: "r1", _type: "postChange" },
                    {
                        _key: "r2",
                        _type: "postChange",
                        date: "2026-02-01",
                        kind: "update",
                        note: "Too early.",
                    },
                    {
                        _key: "r3",
                        _type: "postChange",
                        date: "2026-03-05",
                        kind: "erratum",
                        note: "x".repeat(281),
                    },
                ],
            }),
        );
        const paths = errors.map((error) => error.path);
        for (const field of ["date", "kind", "note"]) {
            expect(paths).toContain(
                JSON.stringify(["changelog", { _key: "r1" }, field]),
            );
        }
        expect(paths).toContain(
            JSON.stringify(["changelog", { _key: "r2" }, "date"]),
        );
        expect(paths).toContain(
            JSON.stringify(["changelog", { _key: "r3" }, "kind"]),
        );
        expect(paths).toContain(
            JSON.stringify(["changelog", { _key: "r3" }, "note"]),
        );
    });

    it("dates a change on or after publication", () => {
        expect(checkChangeDate("2026-03-01", "2026-03-01")).toBe(true);
        expect(checkChangeDate("2026-03-01", "2026-02-28")).toMatch(/before/);
        expect(checkChangeDate(undefined, "2026-02-28")).toBe(true);
    });
});

describe("post schema: the slug", () => {
    // As the Studio validates: the CLI reports a slug field's own rules as
    // warnings.
    const slugErrors = async (current: string) =>
        (
            await validate(
                postWith({ slug: { _type: "slug", current } }),
                "studio",
            )
        )
            .filter((error) => error.path === JSON.stringify(["slug"]))
            .map((error) => error.message);

    it("accepts the site's own shape: lowercase letters, digits and hyphens", async () => {
        expect(await slugErrors("running-gui-apps-in-lxc-2")).toEqual([]);
    });

    it("refuses a slug the feed and cache warming would drop", async () => {
        for (const current of ["My Post", "Post", "-post", "post_1", "café"]) {
            expect(await slugErrors(current), current).toEqual([
                "Use lowercase letters, digits and hyphens, starting with a letter or digit.",
            ]);
        }
    });

    it("refuses an address another page answers under /blog", async () => {
        for (const current of ["archive", "tags", "opengraph-image"]) {
            expect(await slugErrors(current), current).toEqual([
                `“${current}” is the address of another page. Choose another slug.`,
            ]);
        }
    });

    it("still requires one", async () => {
        const errors = await validate(postWith({ slug: undefined }), "studio");
        expect(errors).toContainEqual({
            path: JSON.stringify(["slug"]),
            message: "Required",
        });
    });
});
