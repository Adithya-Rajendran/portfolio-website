"use client";

import React from "react";
import SectionHeading from "../section-heading";
import { useSectionInView } from "@/lib/hooks";
import { useInView } from "react-intersection-observer";
import { cn } from "@/lib/utils";
import type { SkillCategory } from "@/sanity.types";

const colorMap: Record<
    "emerald" | "cyan" | "violet",
    {
        heading: string;
        bg: string;
        border: string;
        text: string;
        darkBorder: string;
    }
> = {
    emerald: {
        heading: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        text: "text-emerald-800",
        darkBorder: "dark:border-emerald-500/10",
    },
    cyan: {
        heading: "text-cyan-600 dark:text-cyan-400",
        bg: "bg-cyan-50",
        border: "border-cyan-200",
        text: "text-cyan-800",
        darkBorder: "dark:border-cyan-500/10",
    },
    violet: {
        heading: "text-violet-600 dark:text-violet-400",
        bg: "bg-violet-50",
        border: "border-violet-200",
        text: "text-violet-800",
        darkBorder: "dark:border-violet-500/10",
    },
};

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

    // Track a running index across all category chips so stagger continues
    // smoothly between sections.
    let chipIndex = 0;

    return (
        <section
            id="skills"
            ref={setRefs}
            className="mb-28 max-w-[53rem] scroll-mt-28 text-center sm:mb-40"
        >
            <SectionHeading>My skills</SectionHeading>
            {skillCategories.map((category) => {
                const colors =
                    colorMap[
                        category.colorVariant as "emerald" | "cyan" | "violet"
                    ] || colorMap.emerald;
                return (
                    <React.Fragment key={category._id}>
                        <h3
                            className={`text-xl font-medium capitalize my-4 text-center ${colors.heading}`}
                        >
                            {category.title}
                        </h3>
                        <ul className="flex flex-wrap justify-center gap-2 text-lg text-slate-700">
                            {(category.skills || []).map((skill, index) => {
                                const delayMs = chipIndex++ * 50;
                                return (
                                    <li
                                        key={index}
                                        style={{
                                            transitionDelay: inView
                                                ? `${delayMs}ms`
                                                : "0ms",
                                        }}
                                        className={cn(
                                            `${colors.bg} ${colors.border} ${colors.text} rounded-xl px-5 py-3 dark:bg-white/5 dark:text-slate-300 ${colors.darkBorder}`,
                                            "transition-all duration-500 ease-out",
                                            inView
                                                ? "opacity-100 translate-y-0"
                                                : "opacity-0 translate-y-8",
                                        )}
                                    >
                                        {skill}
                                    </li>
                                );
                            })}
                        </ul>
                    </React.Fragment>
                );
            })}
        </section>
    );
}
