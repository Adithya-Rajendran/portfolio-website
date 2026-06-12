import SectionHeader from "@/components/section-header";
import SectionSpy from "@/components/portfolio/section-spy";
import RevealOnScroll from "@/components/reveal-on-scroll";
import { styleForVariant } from "@/lib/variant-styles";
import type { SkillCategory } from "@/sanity.types";

interface SkillsProps {
    skillCategories: SkillCategory[];
}

/**
 * Server component — the markup ships zero hydration JS. SectionSpy
 * wires the header nav highlight; RevealOnScroll staggers the cards in.
 */
export default function Skills({ skillCategories }: SkillsProps) {
    return (
        <SectionSpy section="Skills" id="skills" className="scroll-mt-28">
            <SectionHeader
                eyebrow="Skills"
                title="Tools I work with"
                description="Day-to-day across cloud, security, and infrastructure."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {skillCategories.map((category, i) => {
                    const styles = styleForVariant(category.colorVariant);
                    return (
                        <RevealOnScroll
                            key={category._id}
                            delayMs={Math.min(i * 90, 360)}
                            className="os-card p-7"
                        >
                            <h3
                                className={`text-xs font-semibold uppercase tracking-[0.18em] ${styles.textColor} mb-5`}
                            >
                                {category.title}
                            </h3>
                            <ul className="flex flex-wrap gap-2">
                                {(category.skills || []).map((skill, index) => (
                                    <li
                                        key={index}
                                        className="rounded-full px-3.5 py-1.5 text-sm font-medium bg-white/70 border border-slate-200/70 text-slate-700 dark:bg-white/[0.04] dark:border-white/[0.08] dark:text-slate-200"
                                    >
                                        {skill}
                                    </li>
                                ))}
                            </ul>
                        </RevealOnScroll>
                    );
                })}
            </div>
        </SectionSpy>
    );
}
