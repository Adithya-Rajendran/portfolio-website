"use client";

import React from "react";
import SectionHeader from "@/components/section-header";
import { useSectionInView } from "@/lib/hooks";
import { useInView } from "react-intersection-observer";
import { cn } from "@/lib/utils";
import { variantStyles } from "@/components/home/constants";
import type { SkillCategory } from "@/sanity.types";

interface SkillsProps {
    skillCategories: SkillCategory[];
}

export default function Skills({ skillCategories }: SkillsProps) {
    const { ref: sectionRef } = useSectionInView("Skills");
    const { ref: visibilityRef, inView } = useInView({
        threshold: 0.15,
        triggerOnce: true,
    });
    const setRefs = React.useCallback(
        (node: HTMLElement | null) => {
            sectionRef(node);
            visibilityRef(node);
        },
        [sectionRef, visibilityRef],
    );

    let chipIndex = 0;

    return (
        <section id="skills" ref={setRefs} className="scroll-mt-28">
            <SectionHeader
                eyebrow="Skills"
                title="Tools I work with"
                description="Day-to-day across cloud, security, and infrastructure."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {skillCategories.map((category) => {
                    const styles =
                        variantStyles[category.colorVariant ?? "emerald"] ||
                        variantStyles.emerald;
                    return (
                        <div
                            key={category._id}
                            className="os-card rounded-3xl p-7"
                        >
                            <h3
                                className={`text-xs font-semibold uppercase tracking-[0.18em] ${styles.textColor} mb-5`}
                            >
                                {category.title}
                            </h3>
                            <ul className="flex flex-wrap gap-2">
                                {(category.skills || []).map((skill, index) => {
                                    const delayMs = chipIndex++ * 30;
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
                                                "transition-all duration-500 ease-out",
                                                inView
                                                    ? "opacity-100 translate-y-0"
                                                    : "opacity-0 translate-y-3",
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
