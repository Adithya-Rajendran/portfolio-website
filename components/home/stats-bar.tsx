import RevealOnScroll from "@/components/reveal-on-scroll";
import { IconPill } from "@/components/ui/icon-pill";
import { Award, Briefcase, GraduationCap, Rocket } from "lucide-react";

interface StatsBarProps {
    certCount?: number;
    projectCount?: number;
    postCount?: number;
}

/**
 * Four stat rows grouped into a single One UI-style card. On wide
 * viewports the rows lay out in a 4-col grid with vertical dividers;
 * on narrow viewports they stack as 2x2 with horizontal dividers.
 */
export default function StatsBar({
    certCount,
    projectCount,
    postCount,
}: StatsBarProps) {
    const stats = [
        { Icon: Briefcase, color: "c1" as const, value: "3+", label: "Years in cloud" },
        {
            Icon: Award,
            color: "c2" as const,
            value: certCount && certCount > 0 ? `${certCount}` : "5+",
            label: "Certifications",
        },
        {
            Icon: Rocket,
            color: "c3" as const,
            value: projectCount && projectCount > 0 ? `${projectCount}` : "10+",
            label: "Projects shipped",
        },
        {
            Icon: GraduationCap,
            color: "c1" as const,
            value: postCount && postCount > 0 ? `${postCount}` : "Dozens",
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
