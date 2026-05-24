"use client";

import React from "react";
import SectionHeader from "@/components/section-header";
import { useSectionInView } from "@/lib/hooks";
import { useInView } from "react-intersection-observer";
import { cn } from "@/lib/utils";
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

    // Running stagger index across every chip in every category.
    let chipIndex = 0;

    return (
        <section id="skills" ref={setRefs} className="scroll-mt-28">
            <SectionHeader
                eyebrow="Skills"
                title="Tools I work with"
                description="Day-to-day across cloud, security, and infrastructure."
            />

            <div className="space-y-10">
                {skillCategories.map((category) => (
                    <div key={category._id}>
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-4">
                            {category.title}
                        </h3>
                        <ul className="flex flex-wrap gap-2">
                            {(category.skills || []).map((skill, index) => {
                                const delayMs = chipIndex++ * 35;
                                return (
                                    <li
                                        key={index}
                                        style={{
                                            transitionDelay: inView
                                                ? `${delayMs}ms`
                                                : "0ms",
                                        }}
                                        className={cn(
                                            "rounded-full px-4 py-2 text-sm",
                                            "border border-emerald-200/70 bg-white text-slate-700",
                                            "dark:border-white/8 dark:bg-white/[0.03] dark:text-slate-300",
                                            "transition-all duration-500 ease-out",
                                            inView
                                                ? "opacity-100 translate-y-0"
                                                : "opacity-0 translate-y-4",
                                        )}
                                    >
                                        {skill}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </div>
        </section>
    );
}
