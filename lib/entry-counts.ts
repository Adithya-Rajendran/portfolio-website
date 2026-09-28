/**
 * "In this entry" (G1): what a post holds, counted from its body for the
 * record in the post rail ("4 sections · 8 subsections · 17 listings").
 * Pure; the numbers match the page because both read `indexProse`.
 */
import { extractHeadings, type HeadingSourceBlock } from "@/lib/headings";
import { indexProse, type ProseIndex } from "@/lib/prose";

export interface EntryCounts {
    /** h2 headings. */
    sections: number;
    /** h3 and h4 headings. */
    subsections: number;
    /** Photographs (Pl. I …). */
    plates: number;
    /** Diagrams, plots and screenshots (Fig. 1 …). */
    figures: number;
    listings: number;
    notes: number;
}

export function entryCounts(
    body: readonly HeadingSourceBlock[] | null | undefined,
    index: ProseIndex = indexProse(body),
): EntryCounts {
    const headings = extractHeadings({ body });
    const figures = Object.values(index.figures);
    return {
        sections: headings.filter((heading) => heading.level === 2).length,
        subsections: headings.filter((heading) => heading.level > 2).length,
        plates: figures.filter((figure) => figure.kind === "plate").length,
        figures: figures.filter((figure) => figure.kind === "figure").length,
        listings: Object.keys(index.listings).length,
        notes: index.notes.length,
    };
}

const NOUNS: [keyof EntryCounts, string, string][] = [
    ["sections", "section", "sections"],
    ["subsections", "subsection", "subsections"],
    ["plates", "plate", "plates"],
    ["figures", "figure", "figures"],
    ["listings", "listing", "listings"],
    ["notes", "note", "notes"],
];

/** "4 sections", "1 plate": the non-zero counts, in a fixed order. */
export function entryInside(counts: EntryCounts): string[] {
    return NOUNS.filter(([key]) => counts[key] > 0).map(
        ([key, one, many]) =>
            `${counts[key].toLocaleString("en-US")} ${counts[key] === 1 ? one : many}`,
    );
}

/** "1,239 words": the length line of the record. */
export function wordsLabel(words: number): string {
    return `${words.toLocaleString("en-US")} ${words === 1 ? "word" : "words"}`;
}
