/**
 * Dates as the site prints them, worded by hand rather than through Intl or
 * `toLocale*`, so the server, every browser and the feed agree whatever the
 * locale, ICU build or time zone: "30 Mar 2026" for an entry
 * (`formatEntryDate`), "Mar 2024" for the record (`formatTimelineDate`, the
 * flight's readout). No imports, so any module can read it.
 * lib/designations.ts keeps its own pattern: it is kept free of imports.
 */

/** The months as every date on the site abbreviates them. */
export const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
] as const;

/** The "YYYY-MM-DD" a date or a datetime starts with, else null. */
export function dateOnly(value: string | null | undefined): string | null {
    return /^\d{4}-\d{2}-\d{2}/.exec(value ?? "")?.[0] ?? null;
}

/** 2024, 3 → "Mar 2024" (the month counted from 1). */
export function monthYear(year: number, month: number): string {
    return `${MONTHS[month - 1]} ${year}`;
}
