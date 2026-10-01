import { describe, expect, it } from "vitest";
import {
    LEAD_KEY,
    LISTING_MEASURE,
    leadPlateIndex,
    calloutHeading,
    figureKind,
    indexProse,
    languageName,
    listingLabel,
    type NumberedFootnote,
} from "@/lib/prose";

type Block = Parameters<typeof indexProse>[0] extends
    readonly (infer B)[] | null | undefined
    ? B
    : never;

function code(key: string, text: string, extra: Record<string, unknown> = {}) {
    return { _key: key, _type: "code", code: text, ...extra } as Block;
}

function image(key: string, kind?: string, asset = true) {
    return {
        _key: key,
        _type: "image",
        ...(kind ? { kind } : {}),
        ...(asset ? { asset: { _ref: `image-${key}-10x10-png` } } : {}),
    } as Block;
}

function paragraph(
    key: string,
    parts: (string | [text: string, note: string])[],
): Block {
    const markDefs: { _key: string; _type: string; text: string }[] = [];
    const children = parts.map((part, index) => {
        if (typeof part === "string") {
            return {
                _key: `${key}s${index}`,
                _type: "span",
                text: part,
                marks: [],
            };
        }
        const def = { _key: "n1", _type: "footnote", text: part[1] };
        markDefs.push(def);
        return {
            _key: `${key}s${index}`,
            _type: "span",
            text: part[0],
            marks: [def._key],
        };
    });
    return {
        _key: key,
        _type: "block",
        style: "normal",
        markDefs,
        children,
    } as Block;
}

describe("listings", () => {
    it("numbers listings in reading order with unique labels", () => {
        const { listings } = indexProse([
            code("a", "echo 1", { language: "bash" }),
            paragraph("p", ["Between."]),
            code("b", "echo 2", { language: "bash", filename: "install.sh" }),
            code("c", "plain"),
        ]);
        // One name: the file name, else the language.
        expect(listings.a.name).toBe("Bash");
        expect(listings.b.name).toBe("install.sh");
        expect(listings.a.label).toBe("Listing 1, Bash");
        expect(listings.b.label).toBe("Listing 2, install.sh");
        expect(listings.c.label).toBe("Listing 3, Text");
        expect(new Set(Object.values(listings).map((l) => l.label)).size).toBe(
            3,
        );
    });

    it("measures the longest line, tabs counted as four", () => {
        const { listings } = indexProse([
            code("a", `short\n${"x".repeat(LISTING_MEASURE)}\n\n`),
            code("tabs", `\t\t${"x".repeat(9)}`),
            code("empty", ""),
        ]);
        expect(listings.a.longest).toBe(64);
        expect(listings.tabs.longest).toBe(17);
        expect(listings.empty.longest).toBe(0);
    });

    it("keeps every listing at the measure while each fits its 64 columns", () => {
        const { listings } = indexProse([
            code("at", `short\n${"x".repeat(LISTING_MEASURE)}`),
            code("short", "echo 1"),
        ]);
        expect(LISTING_MEASURE).toBe(64);
        expect(listings.at.wide).toBe(false);
        expect(listings.short.wide).toBe(false);
    });

    it("breaks every listing out wide once one is past the measure, so they share one width", () => {
        const { listings } = indexProse([
            code("short", "echo 1"),
            paragraph("p", ["Between."]),
            code("tabs", `\t\t${"x".repeat(LISTING_MEASURE - 7)}`),
        ]);
        expect(listings.tabs.longest).toBe(LISTING_MEASURE + 1);
        expect(listings.tabs.wide).toBe(true);
        expect(listings.short.wide).toBe(true);
    });

    it("names languages for people", () => {
        expect(languageName("yaml")).toBe("YAML");
        expect(languageName("sh")).toBe("Shell");
        expect(languageName(undefined)).toBe("Text");
        expect(languageName("nginx")).toBe("nginx");
        expect(listingLabel(4, "Go")).toBe("Listing 4, Go");
    });
});

describe("plates and figures", () => {
    it("sorts photographs from drawings, and numbers neither", () => {
        const { figures } = indexProse([
            image("p1"),
            image("d1", "diagram"),
            image("p2", "photo"),
            image("s1", "screenshot"),
            {
                _key: "g",
                _type: "gallery",
                images: [image("g1"), image("g2", "plot")],
            } as Block,
        ]);
        expect(figures).toEqual({
            p1: { kind: "plate" },
            d1: { kind: "figure" },
            p2: { kind: "plate" },
            s1: { kind: "figure" },
            g1: { kind: "plate" },
            g2: { kind: "figure" },
        });
    });

    it("indexes a post's cover, the lead plate, by its kind", () => {
        const { figures } = indexProse([image("p1"), image("d1", "plot")], {
            lead: { asset: { _ref: "image-cover-10x10-png" } },
        });
        expect(figures[LEAD_KEY]).toEqual({ kind: "plate" });
        const drawn = indexProse([image("d1", "plot")], {
            lead: { asset: { _ref: "image-cover-10x10-png" }, kind: "diagram" },
        });
        expect(drawn.figures[LEAD_KEY]).toEqual({ kind: "figure" });
        expect(
            indexProse([image("p1")], { lead: { asset: undefined } }).figures,
        ).not.toHaveProperty(LEAD_KEY);
    });

    it("places the lead plate after the first paragraph", () => {
        const heading = {
            _key: "h",
            _type: "block",
            style: "h2",
            children: [],
        } as Block;
        const item = {
            _key: "li",
            _type: "block",
            style: "normal",
            listItem: "bullet",
            children: [],
        } as Block;
        expect(
            leadPlateIndex([heading, item, paragraph("p", ["Text."]), heading]),
        ).toBe(3);
        expect(leadPlateIndex([heading, code("c", "x")])).toBe(0);
        expect(leadPlateIndex([])).toBe(0);
    });

    it("skips images without a file, as the page does", () => {
        const { figures } = indexProse([
            image("x", undefined, false),
            image("y"),
        ]);
        expect(figures.x).toBeUndefined();
        expect(figures.y).toEqual({ kind: "plate" });
    });

    it("treats an image with no kind as a photograph", () => {
        expect(figureKind(undefined)).toBe("plate");
        expect(figureKind("photo")).toBe("plate");
        expect(figureKind("plot")).toBe("figure");
    });
});

describe("footnotes", () => {
    it("numbers notes across blocks in reading order, on a copy of the body", () => {
        const body = [
            paragraph("a", ["One", [" cited", "First."]]),
            paragraph("b", ["No note here."]),
            paragraph("c", [["Two", "Second."]]),
        ];
        const index = indexProse(body);
        expect(index.notes).toEqual([
            { number: 1, text: "First.", id: "fn-1", refId: "fnref-1" },
            { number: 2, text: "Second.", id: "fn-2", refId: "fnref-2" },
        ]);
        const defs = (block: unknown) =>
            (block as { markDefs: NumberedFootnote[] }).markDefs;
        expect(defs(index.body[0])[0].number).toBe(1);
        expect(defs(index.body[2])[0].number).toBe(2);
        // The input is left as it was.
        expect(defs(body[0])[0].number).toBeUndefined();
    });

    it("leaves a note that no text carries, or one without text, unnumbered", () => {
        const orphan = {
            _key: "o",
            _type: "block",
            style: "normal",
            markDefs: [{ _key: "n1", _type: "footnote", text: "Unused." }],
            children: [{ _key: "s", _type: "span", text: "Text", marks: [] }],
        } as Block;
        const index = indexProse([orphan, paragraph("e", [["Empty", "  "]])]);
        expect(index.notes).toEqual([]);
    });

    it("keeps other annotations as they are", () => {
        const block = {
            _key: "l",
            _type: "block",
            style: "normal",
            markDefs: [
                { _key: "k1", _type: "contentLink", href: "/blog" },
                { _key: "k2", _type: "footnote", text: "Note." },
            ],
            children: [
                { _key: "s1", _type: "span", text: "Link", marks: ["k1"] },
                { _key: "s2", _type: "span", text: " and note", marks: ["k2"] },
            ],
        } as Block;
        const [out] = indexProse([block]).body;
        expect((out as unknown as { markDefs: unknown[] }).markDefs).toEqual([
            { _key: "k1", _type: "contentLink", href: "/blog" },
            { _key: "k2", _type: "footnote", text: "Note.", number: 1 },
        ]);
    });

    it("handles an empty or missing body", () => {
        expect(indexProse(undefined)).toEqual({
            body: [],
            listings: {},
            figures: {},
            notes: [],
        });
    });
});

describe("calloutHeading", () => {
    it("says the tone in words, then the title", () => {
        expect(calloutHeading({ tone: "caution", title: "Back up" })).toBe(
            "Caution: Back up",
        );
        expect(calloutHeading({ tone: "tip" })).toBe("Tip");
        expect(calloutHeading({})).toBe("Note");
    });
});
