import { describe, expect, it } from "vitest";
import { entryCounts, entryInside, wordsLabel } from "@/lib/entry-counts";

type Body = NonNullable<Parameters<typeof entryCounts>[0]>;

function heading(key: string, style: "h2" | "h3" | "h4", text: string) {
    return {
        _key: key,
        _type: "block",
        style,
        markDefs: [],
        children: [{ _key: `${key}s`, _type: "span", text, marks: [] }],
    };
}

function noted(key: string, note: string) {
    return {
        _key: key,
        _type: "block",
        style: "normal",
        markDefs: [{ _key: "n", _type: "footnote", text: note }],
        children: [
            { _key: `${key}s`, _type: "span", text: "Cited", marks: ["n"] },
        ],
    };
}

const asset = { asset: { _ref: "image-a-10x10-png" } };

describe("entryCounts", () => {
    it("counts sections, subsections, plates, figures, listings and notes", () => {
        const body = [
            heading("a", "h2", "One"),
            heading("b", "h3", "One point one"),
            heading("c", "h4", "Detail"),
            heading("d", "h2", "Two"),
            { _key: "i1", _type: "image", ...asset },
            { _key: "i2", _type: "image", kind: "diagram", ...asset },
            { _key: "i3", _type: "image" },
            { _key: "k1", _type: "code", code: "echo" },
            { _key: "k2", _type: "code", code: "echo" },
            noted("p1", "A note."),
            noted("p2", "Another."),
            heading("e", "h2", ""),
        ] as unknown as Body;
        expect(entryCounts(body)).toEqual({
            sections: 2,
            subsections: 2,
            plates: 1,
            figures: 1,
            listings: 2,
            notes: 2,
        });
    });

    it("matches the published posts' shapes", () => {
        // The DGX Spark post: 4 h2, 8 h3, 17 listings.
        const dgx = [
            ...Array.from({ length: 4 }, (_, i) =>
                heading(`h2-${i}`, "h2", `Section ${i}`),
            ),
            ...Array.from({ length: 8 }, (_, i) =>
                heading(`h3-${i}`, "h3", `Step ${i}`),
            ),
            ...Array.from({ length: 17 }, (_, i) => ({
                _key: `k${i}`,
                _type: "code",
                code: "x",
            })),
        ] as unknown as Body;
        expect(entryInside(entryCounts(dgx))).toEqual([
            "4 sections",
            "8 subsections",
            "17 listings",
        ]);
        // The homelab post: 8 h2 and 4 photographs.
        const homelab = [
            ...Array.from({ length: 8 }, (_, i) =>
                heading(`h${i}`, "h2", `Section ${i}`),
            ),
            ...Array.from({ length: 4 }, (_, i) => ({
                _key: `i${i}`,
                _type: "image",
                ...asset,
            })),
        ] as unknown as Body;
        expect(entryInside(entryCounts(homelab))).toEqual([
            "8 sections",
            "4 plates",
        ]);
    });

    it("is all zeros for an empty body", () => {
        expect(entryInside(entryCounts([]))).toEqual([]);
        expect(entryInside(entryCounts(undefined))).toEqual([]);
    });
});

describe("entryInside and wordsLabel", () => {
    it("uses the singular for one", () => {
        expect(
            entryInside({
                sections: 1,
                subsections: 0,
                plates: 1,
                figures: 1,
                listings: 1,
                notes: 1,
            }),
        ).toEqual(["1 section", "1 plate", "1 figure", "1 listing", "1 note"]);
        expect(wordsLabel(1)).toBe("1 word");
        expect(wordsLabel(1239)).toBe("1,239 words");
    });
});
