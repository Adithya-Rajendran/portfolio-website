import { cacheLife } from "next/cache";

/**
 * Dates in render. Under Cache Components a page may not read the clock
 * outside `"use cache"`, so "today" comes from one cached helper that
 * refreshes daily; everything derived from it (the copyright year, the
 * orbit map's "now") is a pure function of that string.
 */

/** Today's date in UTC, `YYYY-MM-DD`, refreshed about once a day. */
export async function getToday(): Promise<string> {
    "use cache";
    cacheLife("days");
    return new Date().toISOString().slice(0, 10);
}
