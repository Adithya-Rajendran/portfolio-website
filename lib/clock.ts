import { cacheLife } from "next/cache";
import type { DatePrecision } from "@/lib/profile-fields";

/**
 * Dates in render. Under Cache Components a page may not read the clock
 * outside `"use cache"`, so "today" comes from one cached helper that
 * refreshes daily; everything derived from it (the copyright year, mission
 * elapsed time, the orbit map's "now") is a pure function of that string.
 */

/** Today's date in UTC, `YYYY-MM-DD`, refreshed about once a day. */
export async function getToday(): Promise<string> {
    "use cache";
    cacheLife("days");
    return new Date().toISOString().slice(0, 10);
}

export interface LaunchDate {
    date: string;
    precision?: DatePrecision | null;
}

export interface MissionElapsedTime {
    /** "MET 7Y 08M 27D", "MET 7Y 08M" or "MET c. 7Y" (aria-hidden). */
    short: string;
    /** The same in words, for screen readers. */
    long: string;
}

const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

function parts(iso: string): [number, number, number] | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!match) return null;
    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function plural(n: number, unit: string): string {
    return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

/**
 * Mission elapsed time from the launch to `today`, never more precise
 * than the launch date is known: a year-only launch gives whole years,
 * marked approximate ("c."), and never a month or day. Returns null for a
 * missing or unreadable launch, or one after today.
 */
export function formatMet(
    launch: LaunchDate | null | undefined,
    today: string,
): MissionElapsedTime | null {
    const from = launch?.date ? parts(launch.date) : null;
    const to = parts(today);
    if (!from || !to) return null;
    const [fy, fm, fd] = from;
    const [ty, tm, td] = to;
    const precision = launch?.precision ?? "day";

    if (precision === "year") {
        const years = ty - fy;
        if (years < 0) return null;
        return {
            short: `MET c. ${years}Y`,
            long: `Mission elapsed time: about ${plural(years, "year")} since launch in ${fy}`,
        };
    }

    // Whole months from the launch, then the days since the last monthly
    // anniversary (clamped to the month's end: 31 January + 1 month is 29
    // February).
    const anniversary = (whole: number) => {
        const index = fm - 1 + whole;
        const year = fy + Math.floor(index / 12);
        const month = index % 12;
        const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        return Date.UTC(year, month, Math.min(fd, last));
    };
    const todayMs = Date.UTC(ty, tm - 1, td);
    let whole = (ty - fy) * 12 + (tm - fm);
    if (precision !== "month" && anniversary(whole) > todayMs) whole -= 1;
    if (whole < 0) return null;
    const days = Math.round((todayMs - anniversary(whole)) / 86_400_000);
    const years = Math.floor(whole / 12);
    const months = whole % 12;

    const pad = (n: number) => String(n).padStart(2, "0");
    if (precision === "month") {
        return {
            short: `MET ${years}Y ${pad(months)}M`,
            long: `Mission elapsed time: ${plural(years, "year")}, ${plural(months, "month")} since launch in ${MONTHS[fm - 1]} ${fy}`,
        };
    }
    return {
        short: `MET ${years}Y ${pad(months)}M ${pad(days)}D`,
        long: `Mission elapsed time: ${plural(years, "year")}, ${plural(months, "month")}, ${plural(days, "day")} since launch on ${fd} ${MONTHS[fm - 1]} ${fy}`,
    };
}
