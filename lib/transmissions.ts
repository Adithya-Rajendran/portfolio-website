import { formatLogNumber } from "@/lib/designations";
import { monthLabel, type LogEntry } from "@/lib/log-index";

/**
 * Fig. 1 · Transmissions: every Flight Log entry on a real time axis, from
 * the first day of the month of the oldest entry to today, each a mark
 * whose height is its reading time. Ported from the mockup's writing.js
 * (`W.stripHTML`) as a pure function of the entries and `today`, so the
 * server renders the chart and no clock is read in render.
 */

export interface TransmissionsTick {
    /** Percent along the axis. */
    x: number;
    /** "Mar 2026" on the first tick and on January, else "Apr". */
    label: string;
    /** The first tick or a January: a taller tick, labelled with its year. */
    year: boolean;
    /** Every other month tick: its label is dropped on phones. */
    minor: boolean;
}

export interface TransmissionsMark {
    slug: string;
    title: string;
    /** "LOG 003". */
    designation: string;
    /** "003". */
    number: string;
    readMinutes: number | null;
    /** Percent along the axis. */
    x: number;
    /** Height as a share of the plot, 0.34–1 by reading time. */
    h: number;
    /** The newest entry, drawn in the accent. */
    latest: boolean;
    /** The next newer mark is close: set the label to the left. */
    labelLeft: boolean;
    /** Right of the middle: the hover tip opens to the left, so it stays
     *  on the page. */
    tipLeft: boolean;
}

export interface TransmissionsChart {
    /** "Mar 2026": the month the axis starts. */
    from: string;
    ticks: TransmissionsTick[];
    /** Newest first, like the index. */
    marks: TransmissionsMark[];
    /** Percent along the axis of today. */
    now: number;
    entries: number;
    words: number;
}

const DAY = 86_400_000;
/** The axis runs a few days past today, so the "Now" rule sits inside it. */
const PAD_DAYS = 4;
/** Beyond this many months only years are ticked. */
const MAX_MONTH_TICKS = 18;
/** Marks closer than this (percent) set their label on the other side. */
const CROWDED = 6;

function dayUtc(date: string): number {
    const [year, month, day] = date.split("-").map(Number);
    return Date.UTC(year, (month || 1) - 1, day || 1);
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * The chart for `entries` (newest first, as `logEntries` returns them) as
 * of `today` (`YYYY-MM-DD`). Null when no entry has a date.
 */
export function transmissions(
    entries: readonly LogEntry[],
    today: string,
): TransmissionsChart | null {
    const dated = entries
        .filter((entry) => entry.publishedAt)
        .sort((a, b) => b.number - a.number);
    if (dated.length === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;

    const oldest = dated.reduce(
        (first, entry) =>
            entry.publishedAt < first ? entry.publishedAt : first,
        dated[0].publishedAt,
    );
    const newest = dated.reduce(
        (latest, entry) =>
            entry.publishedAt > latest ? entry.publishedAt : latest,
        today,
    );
    const start = Date.UTC(
        Number(oldest.slice(0, 4)),
        Number(oldest.slice(5, 7)) - 1,
        1,
    );
    const end = dayUtc(newest) + PAD_DAYS * DAY;
    const x = (date: string) =>
        round(((dayUtc(date) - start) / (end - start)) * 100);

    const months: { date: string; month: number }[] = [];
    let year = Number(oldest.slice(0, 4));
    let month = Number(oldest.slice(5, 7));
    while (Date.UTC(year, month - 1, 1) <= dayUtc(newest)) {
        months.push({
            date: `${year}-${String(month).padStart(2, "0")}-01`,
            month,
        });
        month += 1;
        if (month > 12) {
            month = 1;
            year += 1;
        }
    }
    const yearsOnly = months.length > MAX_MONTH_TICKS;
    const ticks = months
        .filter((tick, index) => !yearsOnly || index === 0 || tick.month === 1)
        .map((tick, index) => {
            const first = index === 0 || tick.month === 1;
            return {
                x: x(tick.date),
                label: first
                    ? monthLabel(tick.date)
                    : monthLabel(tick.date).slice(0, 3),
                year: first,
                minor: !first && index % 2 === 1,
            };
        });

    const minutes = dated.map((entry) => entry.readMinutes ?? 0);
    const low = Math.min(...minutes);
    const high = Math.max(...minutes);
    const marks = dated.map((entry, index) => {
        const newer = dated[index - 1];
        const at = x(entry.publishedAt);
        return {
            slug: entry.slug,
            title: entry.title,
            designation: entry.designation,
            number: formatLogNumber(entry.number),
            readMinutes: entry.readMinutes,
            x: at,
            h:
                high > low
                    ? round(
                          0.34 +
                              (0.66 * ((entry.readMinutes ?? 0) - low)) /
                                  (high - low),
                      )
                    : 1,
            latest: index === 0,
            labelLeft: Boolean(newer && x(newer.publishedAt) - at < CROWDED),
            tipLeft: at > 50,
        };
    });

    return {
        from: monthLabel(oldest),
        ticks,
        marks,
        now: x(today),
        entries: dated.length,
        words: dated.reduce((sum, entry) => sum + entry.wordCount, 0),
    };
}
