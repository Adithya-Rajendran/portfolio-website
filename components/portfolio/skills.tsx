"use client";

import SectionHeader from "@/components/section-header";
import { useSectionReveal } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { styleForVariant } from "@/lib/variant-styles";
import type { SkillCategory } from "@/sanity.types";

interface SkillsProps {
    skillCategories: SkillCategory[];
}

export default function Skills({ skillCategories }: SkillsProps) {
    const { ref, inView } = useSectionReveal("Skills");

    let chipIndex = 0;

    return (
        <section id="skills" ref={ref} className="scroll-mt-28">
            <SectionHeader
                eyebrow="Skills"
                title="Tools I work with"
                description="Day-to-day across cloud, security, and infrastructure."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {skillCategories.map((category) => {
                    const styles = styleForVariant(category.colorVariant);
                    return (
                        <div key={category._id} className="os-card p-7">
                            <h3
                                className={`text-xs font-semibold uppercase tracking-[0.18em] ${styles.textColor} mb-5`}
                            >
                                {category.title}
                            </h3>
                            <ul className="flex flex-wrap gap-2">
                                {(category.skills || []).map((skill, index) => {
                                    const delayMs = Math.min(
                                        chipIndex++ * 30,
                                        400,
                                    );
                                    return (
                                        <li
                                            key={index}
                                            style={{
                                                transitionDelay: inView
                                                    ? `${delayMs}ms`
                                                    : "0ms",
                                            }}
                                            className={cn(
                                                "rounded-full px-3.5 py-1.5 text-sm font-medium",
                                                "bg-white/70 border border-slate-200/70 text-slate-700",
                                                "dark:bg-white/[0.04] dark:border-white/[0.08] dark:text-slate-200",
                                                "motion-safe:transition-all motion-safe:duration-500 motion-safe:ease-out",
                                                !inView &&
                                                    "motion-safe:opacity-0 motion-safe:translate-y-3",
                                            )}
                                        >
                                            {skill}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
