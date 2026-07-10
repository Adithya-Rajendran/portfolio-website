import type { Experience } from "@/sanity.types";

interface StatsBarProps {
    /** Pre-computed years-in-cloud string (e.g. "4+" or "TBC") */
    yearsValue: string;
    /** Count of certifications from Sanity */
    certCount?: number;
    /** Count of projects from Sanity */
    projectCount?: number;
    /** Count of published blog posts from Sanity */
    postCount?: number;
}

const FALLBACK = "TBC";

/**
 * Pulls the earliest 4-digit year out of a list of experience `date`
 * fields. Date is free-form text in Sanity (e.g. "Aug 2021 – Present"),
 * so we just scan for the smallest year token across all entries.
 */
function earliestYearFrom(experiences: Experience[] = []): number | null {
    let earliest: number | null = null;
    for (const exp of experiences) {
        if (!exp.date) continue;
        const matches = exp.date.match(/\b(19\d{2}|20\d{2})\b/g);
        if (!matches) continue;
        for (const m of matches) {
            const year = parseInt(m, 10);
            if (!earliest || year < earliest) earliest = year;
        }
    }
    return earliest;
}

/**
 * Compute the "Years in cloud" stat from Sanity experiences. Must be
 * called from a "use cache" boundary in the server parent — Next.js
 * 16's Cache Components forbid `new Date()` in unscoped prerender.
 */
export function computeYearsValue(experiences: Experience[] = []): string {
    const earliestYear = earliestYearFrom(experiences);
    if (!earliestYear) return FALLBACK;
    return `${Math.max(1, new Date().getFullYear() - earliestYear)}+`;
}

function formatCount(n?: number): string {
    return n && n > 0 ? `${n}` : FALLBACK;
}

/**
 * tmux-style status bar: a full-width hairline strip of mono segments —
 * accent value, lowercase label. Values come directly from Sanity;
 * empty categories show "TBC" rather than a fake number.
 */
export default function StatsBar({
    yearsValue,
    certCount,
    projectCount,
    postCount,
}: StatsBarProps) {
    const stats = [
        { value: yearsValue, label: "years in cloud" },
        { value: formatCount(certCount), label: "certifications" },
        { value: formatCount(projectCount), label: "projects shipped" },
        { value: formatCount(postCount), label: "articles & write-ups" },
    ];

    return (
        <section
            aria-label="Stats"
            className="w-full border-y border-slate-400/30 dark:border-white/10"
        >
            <div className="max-w-6xl mx-auto px-6 sm:px-8 py-4 grid grid-cols-2 gap-y-4 sm:flex sm:flex-wrap">
                {stats.map(({ value, label }) => (
                    <div
                        key={label}
                        className="flex items-baseline gap-2.5 sm:px-6 sm:first:pl-0 sm:border-l sm:first:border-l-0 sm:border-slate-400/30 dark:sm:border-white/10"
                    >
                        <span className="font-term text-xl sm:text-2xl font-bold text-accent">
                            {value}
                        </span>
                        <span className="font-term text-xs sm:text-[0.85rem] text-slate-500 dark:text-slate-400">
                            {label}
                        </span>
                    </div>
                ))}
            </div>
        </section>
    );
}
