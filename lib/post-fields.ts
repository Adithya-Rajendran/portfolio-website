/**
 * Option lists and pure rules for posts and the shared rich text
 * (`contentBody`), read by the Sanity schema (`sanity/schemas/`) and the
 * site's renderers (the post page, the project essay, the RSS feed), so a
 * stored value and what the site draws cannot drift apart. Keep this module
 * free of imports: the Studio and `sanity schema extract` bundle it.
 */

type Option<Value extends string> = {
    readonly title: string;
    readonly value: Value;
};

type ValueOf<List extends readonly Option<string>[]> = List[number]["value"];

/**
 * A callout's tone. `caution` is the advisory box: something that can
 * break a reader's setup or cost them data.
 */
export const CALLOUT_TONES = [
    { title: "Note", value: "note" },
    { title: "Tip", value: "tip" },
    { title: "Warning", value: "warning" },
    { title: "Caution", value: "caution" },
] as const satisfies readonly Option<string>[];
export type CalloutTone = ValueOf<typeof CALLOUT_TONES>;

/** The label printed above a callout with no title of its own. */
export function calloutToneTitle(tone: unknown): string {
    return (
        CALLOUT_TONES.find((option) => option.value === tone)?.title ?? "Note"
    );
}

/**
 * How wide an image in a post sits: the text measure (the default), the
 * whole reading column, or the full width of the page.
 */
export const IMAGE_WIDTHS = [
    { title: "Text width", value: "prose" },
    { title: "Wide (the reading column)", value: "wide" },
    { title: "Full width", value: "full" },
] as const satisfies readonly Option<string>[];
export type ImageWidth = ValueOf<typeof IMAGE_WIDTHS>;

/**
 * An entry in a post's changelog: an update adds or changes content, a
 * correction fixes something the post got wrong (an erratum).
 */
export const CHANGE_KINDS = [
    { title: "Update", value: "update" },
    { title: "Correction", value: "correction" },
] as const satisfies readonly Option<string>[];
export type ChangeKind = ValueOf<typeof CHANGE_KINDS>;

export function changeKindTitle(kind: unknown): string {
    return (
        CHANGE_KINDS.find((option) => option.value === kind)?.title ?? "Update"
    );
}

/** A footnote's text, shown in the margin and in the notes at the end. */
export const FOOTNOTE_MAX = 400;
/** A changelog entry's note. */
export const CHANGE_NOTE_MAX = 280;
/** An image's credit line. */
export const IMAGE_CREDIT_MAX = 120;

/** A changelog entry cannot predate the post it changes. */
export function checkChangeDate(
    publishedAt: string | undefined,
    date: string | undefined,
): true | string {
    if (!publishedAt || !date || date >= publishedAt) return true;
    return "A change cannot be dated before the post was published.";
}
