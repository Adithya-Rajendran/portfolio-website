import { Badge } from "@/components/ui/badge";
import { IconPill } from "@/components/ui/icon-pill";
import { styleForVariant } from "@/lib/variant-styles";
import type { SkillCategory } from "@/sanity.types";
import RevealOnScroll from "@/components/reveal-on-scroll";
import SectionHeader from "@/components/section-header";

interface SkillsPreviewProps {
    skillCategories: SkillCategory[];
}

export default function SkillsPreview({ skillCategories }: SkillsPreviewProps) {
    if (skillCategories.length === 0) return null;

    return (
        <RevealOnScroll
            as="section"
            className="w-full max-w-6xl mx-auto px-4 sm:px-6 pb-20"
        >
            <SectionHeader
                eyebrow="What I work with"
                title="Skills & expertise"
                description="A working knowledge that spans cloud platforms, the security perimeter around them, and the systems that make them run."
                align="center"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {skillCategories.map((category) => {
                    const styles = styleForVariant(category.colorVariant);
                    return (
                        <div key={category._id} className="os-card p-6 sm:p-7">
                            <IconPill
                                icon={styles.icon}
                                color={styles.color}
                                size="md"
                            />
                            <h3 className="mt-5 font-display text-lg font-semibold text-slate-900 dark:text-white">
                                {category.title ?? ""}
                            </h3>
                            <div className="mt-4 flex flex-wrap gap-1.5">
                                {(category.skills ?? []).map((skill, i) => (
                                    <Badge
                                        key={i}
                                        variant={styles.badgeVariant}
                                        className="text-xs"
                                    >
                                        {skill}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </RevealOnScroll>
    );
}
