import RevealOnScroll from "@/components/reveal-on-scroll";
import { Award, Briefcase, GraduationCap, Rocket } from "lucide-react";

interface StatsBarProps {
    certCount?: number;
    projectCount?: number;
    postCount?: number;
}

export default function StatsBar({
    certCount,
    projectCount,
    postCount,
}: StatsBarProps) {
    const stats = [
        { icon: Briefcase, value: "3+", label: "Years in cloud" },
        {
            icon: Award,
            value: certCount && certCount > 0 ? `${certCount}` : "5+",
            label: "Certifications",
        },
        {
            icon: Rocket,
            value: projectCount && projectCount > 0 ? `${projectCount}` : "10+",
            label: "Projects shipped",
        },
        {
            icon: GraduationCap,
            value: postCount && postCount > 0 ? `${postCount}` : "Dozens",
            label: "Articles & write-ups",
        },
    ];

    return (
        <RevealOnScroll
            as="section"
            className="w-full max-w-6xl mx-auto px-2 sm:px-6"
        >
            <div className="glass rounded-2xl p-1 sm:p-1.5">
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-200/60 dark:divide-white/8">
                    {stats.map(({ icon: Icon, value, label }) => (
                        <div
                            key={label}
                            className="flex items-center gap-4 px-5 py-5 sm:py-6"
                        >
                            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-accent-soft border border-accent-soft flex items-center justify-center text-accent">
                                <Icon className="w-4 h-4" />
                            </div>
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
