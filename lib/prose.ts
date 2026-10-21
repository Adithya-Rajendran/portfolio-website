/**
 * One pass over a Portable Text body that numbers what the reader can
 * cite, the footnotes (1, 2 …), and the listings, whose numbers only keep
 * their accessible names apart, in reading order, and sorts its images
 * into photographs and drawings. No plate or figure is numbered: no text
 * cites one, and each caption stands on its own. The post page, the
 * project essay and the RSS feed all read the same index, so the page and
 * the feed never disagree. Pure: no React, no fetches.
 */
import { calloutToneTitle } from "@/lib/post-fields";

type Block = { _key?: string; _type: string; [key: string]: unknown };

/** Display names for the languages the Studio offers and a few aliases. */
const LANGUAGE_NAMES: Record<string, string> = {
    bash: "Bash",
    sh: "Shell",
    shell: "Shell",
    zsh: "Zsh",
    console: "Console",
    yaml: "YAML",
    yml: "YAML",
    json: "JSON",
    javascript: "JavaScript",
    js: "JavaScript",
    jsx: "JSX",
    typescript: "TypeScript",
    ts: "TypeScript",
    tsx: "TSX",
    python: "Python",
    py: "Python",
    go: "Go",
    rust: "Rust",
    html: "HTML",
    css: "CSS",
    sql: "SQL",
    markdown: "Markdown",
    docker: "Dockerfile",
    dockerfile: "Dockerfile",
    toml: "TOML",
    ini: "INI",
    hcl: "HCL",
    c: "C",
    cpp: "C++",
    text: "Text",
    plaintext: "Text",
    txt: "Text",
};

/** "bash" → "Bash"; none → "Text"; an unknown id prints as stored.
 *  @internal Exported for tests. */
export function languageName(language?: string | null): string {
    const id = typeof language === "string" ? language.trim() : "";
    if (!id) return "Text";
    return LANGUAGE_NAMES[id.toLowerCase()] ?? id;
}

export interface ListingInfo {
    number: number;
    /** The file name, else the language ("Bash", "YAML", "Text"), which
     *  a file name already implies: the accessible name's part. */
    name: string;
    /** The bar's label and the feed's caption: the name, except plain
     *  text with no file name, which says nothing a reader needs. */
    caption: string | null;
    /** The accessible name: "Listing 3, install.sh". */
    label: string;
}

/** "Listing 3, install.sh": unique per listing on a page.
 *  @internal Exported for tests. */
export function listingLabel(number: number, name: string): string {
    return `Listing ${number}, ${name}`;
}

type FigureKind = "plate" | "figure";

export interface FigureInfo {
    kind: FigureKind;
}

export interface NoteInfo {
    number: number;
    text: string;
    /** The note in the end list: `fn-3`. */
    id: string;
    /** The raised number in the text: `fnref-3`. */
    refId: string;
}

export interface ProseIndex {
    /**
     * The body with each footnote annotation (markDef) numbered: the
     * renderers read `number` from the markDef they are given.
     */
    body: Block[];
    listings: Record<string, ListingInfo>;
    /** Body images and gallery images that render, by `_key`. */
    figures: Record<string, FigureInfo>;
    notes: NoteInfo[];
}

/** A footnote annotation after `indexProse`: `number` is set when it has text. */
export type NumberedFootnote = {
    _key?: string;
    _type: "footnote";
    text?: string;
    number?: number;
};

/** An image that renders: it has an asset reference. */
export function hasImageAsset(value: unknown): boolean {
    if (!value || typeof value !== "object") return false;
    const asset = (value as { asset?: unknown }).asset;
    return (
        !!asset &&
        typeof asset === "object" &&
        typeof (asset as { _ref?: unknown })._ref === "string"
    );
}

/**
 * Photographs are plates; diagrams, plots and screenshots are figures. An
 * image with no kind (every image saved before kinds existed) is a
 * photograph.
 * @internal Exported for tests.
 */
export function figureKind(kind: unknown): FigureKind {
    return kind === "diagram" || kind === "plot" || kind === "screenshot"
        ? "figure"
        : "plate";
}

function spanMarks(block: Block): string[] {
    const children = Array.isArray(block.children) ? block.children : [];
    const marks: string[] = [];
    for (const child of children) {
        const list = (child as { marks?: unknown })?.marks;
        if (!Array.isArray(list)) continue;
        for (const mark of list) {
            if (typeof mark === "string" && !marks.includes(mark)) {
                marks.push(mark);
            }
        }
    }
    return marks;
}

/** The key the lead plate (a post's cover) is indexed under. */
export const LEAD_KEY = "lead";

/**
 * Numbers a body's listings and footnotes in reading order, and sorts its
 * images. A footnote is numbered where its annotation first appears in
 * the text; an annotation no text carries, or one without a note, is left
 * unnumbered (the renderers then print the text alone).
 */

export function indexProse(
    body: readonly Block[] | null | undefined,
    {
        lead,
    }: {
        /**
         * A post's cover, drawn as the lead plate after the first
         * paragraph: indexed under `LEAD_KEY` when it has an image.
         */
        lead?: { asset?: unknown; kind?: unknown } | null;
    } = {},
): ProseIndex {
    const listings: Record<string, ListingInfo> = {};
    const figures: Record<string, FigureInfo> = {};
    const notes: NoteInfo[] = [];

    const addFigure = (value: Block) => {
        if (typeof value._key !== "string" || !hasImageAsset(value)) return;
        figures[value._key] = { kind: figureKind(value.kind) };
    };

    if (lead && hasImageAsset(lead)) {
        addFigure({ ...lead, _key: LEAD_KEY, _type: "image" });
    }

    const out = (body ?? []).map((block): Block => {
        if (!block || typeof block !== "object") return block;
        if (block._type === "code" && typeof block._key === "string") {
            const number = Object.keys(listings).length + 1;
            const filename =
                typeof block.filename === "string" ? block.filename.trim() : "";
            const name = filename || languageName(block.language as string);
            listings[block._key] = {
                number,
                name,
                caption: filename || name !== languageName() ? name : null,
                label: listingLabel(number, name),
            };
            return block;
        }
        if (block._type === "image") {
            addFigure(block);
            return block;
        }
        if (block._type === "gallery" && Array.isArray(block.images)) {
            for (const image of block.images) {
                if (image && typeof image === "object") addFigure(image);
            }
            return block;
        }
        if (block._type !== "block" || !Array.isArray(block.markDefs)) {
            return block;
        }
        const defs = block.markDefs as NumberedFootnote[];
        if (!defs.some((def) => def?._type === "footnote")) return block;
        const used = spanMarks(block);
        const numbered = new Map<string, number>();
        for (const key of used) {
            const def = defs.find(
                (item) => item?._key === key && item._type === "footnote",
            );
            const text = typeof def?.text === "string" ? def.text.trim() : "";
            if (!def || !text) continue;
            const number = notes.length + 1;
            numbered.set(key, number);
            notes.push({
                number,
                text,
                id: `fn-${number}`,
                refId: `fnref-${number}`,
            });
        }
        return {
            ...block,
            markDefs: defs.map((def) =>
                def?._type === "footnote" && def._key && numbered.has(def._key)
                    ? { ...def, number: numbered.get(def._key) }
                    : def,
            ),
        };
    });

    return { body: out, listings, figures, notes };
}

/**
 * Where the lead plate goes: after the first paragraph (a normal block
 * that is not a list item), so the text opens the entry. 0 (the top) for a
 * body without one.
 */
export function leadPlateIndex(body: readonly Block[]): number {
    const first = body.findIndex(
        (block) =>
            block?._type === "block" &&
            (block.style ?? "normal") === "normal" &&
            !block.listItem,
    );
    return first === -1 ? 0 : first + 1;
}

/**
 * A callout's heading in plain text (the feed): its tone, then its own
 * title when it has one ("Caution: Back up first"). The tone is always
 * said in words, never by colour alone.
 */
export function calloutHeading(value: {
    title?: unknown;
    tone?: unknown;
}): string {
    const tone = calloutToneTitle(value.tone);
    const title = typeof value.title === "string" ? value.title.trim() : "";
    return title ? `${tone}: ${title}` : tone;
}
