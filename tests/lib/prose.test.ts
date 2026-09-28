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
    romanNumeral,
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
        expect(listings.a.label).toBe("Listing 1, Bash");
        expect(listings.b.label).toBe("Listing 2, Bash, install.sh");
        expect(listings.c.label).toBe("Listing 3, Text");
        expect(new Set(Object.values(listings).map((l) => l.label)).size).toBe(
            3,
        );
    });

    it("counts lines without the trailing blank ones", () => {
        const { listings } = indexProse([
            code("a", "one\ntwo\nthree\n\n"),
            code("b", ""),
        ]);
        expect(listings.a.lines).toBe(3);
        expect(listings.b.lines).toBe(0);
    });

    it("breaks out wide only past the 72-column measure, tabs counted as four", () => {
        const at = "x".repeat(LISTING_MEASURE);
        const past = "x".repeat(LISTING_MEASURE + 1);
        const { listings } = indexProse([
            code("at", `short\n${at}`),
            code("past", past),
            code("tabs", `\t\t${"x".repeat(LISTING_MEASURE - 7)}`),
        ]);
        expect(listings.at).toMatchObject({ longest: 72, wide: false });
        expect(listings.past).toMatchObject({ longest: 73, wide: true });
        expect(listings.tabs).toMatchObject({ longest: 73, wide: true });
    });

    it("names languages for people", () => {
        expect(languageName("yaml")).toBe("YAML");
        expect(languageName("sh")).toBe("Shell");
        expect(languageName(undefined)).toBe("Text");
        expect(languageName("nginx")).toBe("nginx");
        expect(
            listingLabel({ number: 4, language: "Go", filename: null }),
        ).toBe("Listing 4, Go");
    });
});

describe("plates and figures", () => {
    it("numbers photographs as plates and drawings as figures, separately", () => {
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
        expect(figures.p1.label).toBe("Pl. I");
        expect(figures.p2.label).toBe("Pl. II");
        expect(figures.g1.label).toBe("Pl. III");
        expect(figures.d1.label).toBe("Fig. 1");
        expect(figures.s1.label).toBe("Fig. 2");
        expect(figures.g2.label).toBe("Fig. 3");
    });

    it("gives a post's cover, the lead plate, the first number of its kind", () => {
        const { figures } = indexProse([image("p1"), image("d1", "plot")], {
            lead: { asset: { _ref: "image-cover-10x10-png" } },
        });
        expect(figures[LEAD_KEY].label).toBe("Pl. I");
        expect(figures.p1.label).toBe("Pl. II");
        expect(figures.d1.label).toBe("Fig. 1");
        const drawn = indexProse([image("d1", "plot")], {
            lead: { asset: { _ref: "image-cover-10x10-png" }, kind: "diagram" },
        });
        expect(drawn.figures[LEAD_KEY].label).toBe("Fig. 1");
        expect(drawn.figures.d1.label).toBe("Fig. 2");
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
        expect(figures.y.label).toBe("Pl. I");
    });

    it("treats an image with no kind as a photograph", () => {
        expect(figureKind(undefined)).toBe("plate");
        expect(figureKind("photo")).toBe("plate");
        expect(figureKind("plot")).toBe("figure");
    });

    it("writes Roman numerals", () => {
        expect([1, 4, 9, 14, 40, 90, 400, 1994].map(romanNumeral)).toEqual([
            "I",
            "IV",
            "IX",
            "XIV",
            "XL",
            "XC",
            "CD",
            "MCMXCIV",
        ]);
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
