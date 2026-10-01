/**
 * Option lists and pure validation rules shared by the Sanity schema
 * (`sanity/schemas/`) and the site code, so a stored value and the type the
 * site reads cannot drift apart. Keep this module free of imports: the Studio
 * and `sanity schema extract` bundle it.
 */

type Option<Value extends string> = {
    readonly title: string;
    readonly value: Value;
};

type ValueOf<List extends readonly Option<string>[]> = List[number]["value"];

export const AVAILABILITY_STATUSES = [
    { title: "Open", value: "open" },
    { title: "Selective", value: "selective" },
    { title: "Closed", value: "closed" },
] as const satisfies readonly Option<string>[];
export type AvailabilityStatus = ValueOf<typeof AVAILABILITY_STATUSES>;

/**
 * How much of a stored date is known. Sanity dates always hold a full
 * `YYYY-MM-DD`, so a date known only to the year is stored as any day in that
 * year plus `year`, and the site prints and plots the year alone.
 */
export const DATE_PRECISIONS = [
    { title: "Exact date", value: "day" },
    { title: "Month and year", value: "month" },
    { title: "Year only", value: "year" },
] as const satisfies readonly Option<string>[];
export type DatePrecision = ValueOf<typeof DATE_PRECISIONS>;

/** Timeline dates are shown as month and year, so a day is never offered. */
export const TIMELINE_DATE_PRECISIONS = [
    { title: "Month and year", value: "month" },
    { title: "Year only", value: "year" },
] as const satisfies readonly Option<DatePrecision>[];
export type TimelineDatePrecision = ValueOf<typeof TIMELINE_DATE_PRECISIONS>;

export const EMPLOYMENT_TYPES = [
    { title: "Full-time", value: "full-time" },
    { title: "Internship", value: "internship" },
    { title: "Part-time", value: "part-time" },
    { title: "Contract", value: "contract" },
    { title: "Degree", value: "degree" },
    { title: "Research", value: "research" },
] as const satisfies readonly Option<string>[];
export type EmploymentType = ValueOf<typeof EMPLOYMENT_TYPES>;

export const CURIOSITY_KINDS = [
    { title: "Question", value: "question" },
    { title: "Building", value: "building" },
    { title: "Reading", value: "reading" },
    { title: "Learning", value: "learning" },
] as const satisfies readonly Option<string>[];
export type CuriosityKind = ValueOf<typeof CURIOSITY_KINDS>;

export const TALK_KINDS = [
    { title: "Talk", value: "talk" },
    { title: "Paper", value: "paper" },
    { title: "Preprint", value: "preprint" },
    { title: "Poster", value: "poster" },
    { title: "Thesis", value: "thesis" },
    { title: "Report", value: "report" },
] as const satisfies readonly Option<string>[];
export type TalkKind = ValueOf<typeof TALK_KINDS>;

export const LINK_KINDS = [
    { title: "Repository", value: "repo" },
    { title: "Documentation", value: "docs" },
    { title: "Paper", value: "paper" },
    { title: "Video", value: "video" },
    { title: "Dataset", value: "dataset" },
    { title: "Demo", value: "demo" },
    { title: "Article", value: "article" },
    { title: "Profile", value: "profile" },
    { title: "Other", value: "other" },
] as const satisfies readonly Option<string>[];
export type LinkKind = ValueOf<typeof LINK_KINDS>;

/**
 * Sanity checks a list field's value against its options only when the field
 * declares a validation rule. Optional list fields use this rule, which adds
 * nothing else, so a value outside the list (a typo in a migration, say) is
 * still reported.
 */
export function listValuesOnly<Rule>(rule: Rule): Rule {
    return rule;
}

/**
 * What you are open to is required unless the status is `closed`: one or
 * more `availability.seeking` lines, or the older single `openTo` line.
 */
export function checkAvailabilitySeeking(
    status: string | undefined,
    seeking: readonly { label?: string }[] | undefined,
    openTo: string | undefined,
): true | string {
    if (!status || status === "closed") return true;
    if (seeking?.some((line) => line?.label?.trim())) return true;
    if (openTo?.trim()) return true;
    return "Add what you are open to, or set the status to Closed.";
}

/**
 * A timeline entry whose end equals its start has no length, so its start
 * counts as unknown: the CV prints the end alone and the flight gives it a
 * nominal span. This is a warning: the date may be right.
 */
export function checkTimelineRange(
    startDate: string | undefined,
    endDate: string | undefined,
): true | string {
    if (!startDate || !endDate || startDate !== endDate) return true;
    return "The start and end dates are the same, so the CV shows only the end date. Check the start date.";
}
