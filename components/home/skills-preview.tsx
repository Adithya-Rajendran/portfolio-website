import { Badge } from "@/components/ui/badge";
import { variantIcons, variantStyles } from "./constants";
import type { SkillCategory } from "@/sanity.types";
import RevealOnScroll from "@/components/reveal-on-scroll";
import SectionHeader from "@/components/section-header";

interface SkillsPreviewProps {
    skillCategories: SkillCategory[];
}

/**
 * Bento-style asymmetric grid: first card spans two columns on desktop
 * for visual rhythm. Each card is a glass surface with a soft gradient
 * wash matching its color variant.
 */
export default function SkillsPreview({ skillCategories }: SkillsPreviewProps) {
    if (skillCategories.length === 0) return null;

    return (
        <RevealOnScroll
            as="section"
            className="w-full max-w-6xl mx-auto px-2 sm:px-6 pb-20"
        >
            <SectionHeader
                eyebrow="What I work with"
                title="Skills & expertise"
                description="A working knowledge that spans cloud platforms, the security perimeter around them, and the systems that make them run."
                align="center"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {skillCategories.map((category, idx) => {
                    const styles =
                        variantStyles[category.colorVariant ?? "emerald"] ||
                        variantStyles.emerald;
                    const icon =
                        variantIcons[category.colorVariant ?? "emerald"] ||
                        variantIcons.emerald;
                    return (
                        <SkillCard
                            key={category._id}
                            icon={icon}
                            title={category.title ?? ""}
                            skills={category.skills ?? []}
                            variant={styles.badgeVariant}
                            accentColor={styles.accentColor}
                            bgColor={styles.bgColor}
                            iconBorder={styles.iconBorder}
                            gradientFrom={styles.gradientFrom}
                            gradientTo={styles.gradientTo}
                            wide={idx === 0}
                        />
                    );
                })}
            </div>
        </RevealOnScroll>
    );
}

function SkillCard({
    icon,
    title,
    skills,
    variant,
    accentColor,
    bgColor,
    iconBorder,
    gradientFrom,
    gradientTo,
    wide,
}: {
    icon: React.ReactNode;
    title: string;
    skills: string[];
    variant: "indigo" | "sky" | "violet";
    accentColor: string;
    bgColor: string;
    iconBorder: string;
    gradientFrom: string;
    gradientTo: string;
    wide?: boolean;
}) {
    return (
        <div
            className={`glass glow-hover relative overflow-hidden rounded-2xl p-6 sm:p-7 ${
                wide ? "md:col-span-2 md:row-span-1" : ""
            }`}
        >
            {/* Soft color wash in the corner */}
            <div
                aria-hidden="true"
                className={`pointer-events-none absolute -top-12 -right-12 w-44 h-44 rounded-full blur-2xl bg-gradient-to-br ${gradientFrom} ${gradientTo}`}
            />

            <div className="relative">
                <div
                    className={`inline-flex items-center justify-center w-11 h-11 rounded-xl ${bgColor} ${accentColor} border ${iconBorder} mb-5`}
                >
                    {icon}
                </div>
                <h3
                    className={`font-display text-lg font-semibold mb-4 text-slate-900 dark:text-white`}
                >
                    {title}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                    {skills.map((skill, i) => (
                        <Badge key={i} variant={variant} className="text-xs">
                            {skill}
                        </Badge>
                    ))}
                </div>
            </div>
        </div>
    );
}
