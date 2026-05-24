import RevealOnScroll from "@/components/reveal-on-scroll";
import { IconPill } from "@/components/ui/icon-pill";
import { Award, Briefcase, GraduationCap, Rocket } from "lucide-react";
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
 * Four stat rows grouped into a single One UI-style card. Values come
 * directly from Sanity content — when a category is empty we show
 * "TBC" rather than a fake fallback number.
 */
export default function StatsBar({
    yearsValue,
    certCount,
    projectCount,
    postCount,
}: StatsBarProps) {
    const stats = [
        {
            Icon: Briefcase,
            color: "c1" as const,
            value: yearsValue,
            label: "Years in cloud",
        },
        {
            Icon: Award,
            color: "c2" as const,
            value: formatCount(certCount),
            label: "Certifications",
        },
        {
            Icon: Rocket,
            color: "c3" as const,
            value: formatCount(projectCount),
            label: "Projects shipped",
        },
        {
            Icon: GraduationCap,
            color: "c1" as const,
            value: formatCount(postCount),
            label: "Articles & write-ups",
        },
    ];

    return (
        <RevealOnScroll
            as="section"
            className="w-full max-w-6xl mx-auto px-4 sm:px-6"
        >
            <div className="os-card rounded-3xl p-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-200/60 dark:divide-white/[0.06]">
                    {stats.map(({ Icon, color, value, label }) => (
                        <div
                            key={label}
                            className="flex items-center gap-4 px-5 py-5 sm:py-6"
                        >
                            <IconPill icon={Icon} color={color} />
                            <div className="min-w-0">
                                <p className="font-display text-2xl font-semibold text-slate-900 dark:text-white leading-none">
                                    {value}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                                    {label}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </RevealOnScroll>
    );
}
