"use client";

import React from "react";
import SectionHeading from "../section-heading";
import { useSectionInView } from "@/lib/hooks";
import { motion } from "motion/react";
import type { SanitySkillCategoryType } from "@/lib/types";

const fadeInAnimationVariants = {
    initial: {
        opacity: 0,
        y: 100,
    },
    animate: (index: number) => ({
        opacity: 1,
        y: 0,
        transition: {
            delay: 0.05 * index,
        },
    }),
};

const colorMap: Record<
    SanitySkillCategoryType["colorVariant"],
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
    skillCategories: SanitySkillCategoryType[];
}

export default function Skills({ skillCategories }: SkillsProps) {
    const { ref } = useSectionInView("Skills");

    return (
        <section
            id="skills"
            ref={ref}
            className="mb-28 max-w-[53rem] scroll-mt-28 text-center sm:mb-40"
        >
            <SectionHeading>My skills</SectionHeading>
            {skillCategories.map((category) => {
                const colors = colorMap[category.colorVariant] || colorMap.emerald;
                return (
                    <React.Fragment key={category._id}>
                        <h3
                            className={`text-xl font-medium capitalize my-4 text-center ${colors.heading}`}
                        >
                            {category.title}
                        </h3>
                        <ul className="flex flex-wrap justify-center gap-2 text-lg text-slate-700">
                            {category.skills.map((skill, index) => (
                                <motion.li
                                    className={`${colors.bg} ${colors.border} ${colors.text} rounded-xl px-5 py-3 dark:bg-white/5 dark:text-slate-300 ${colors.darkBorder}`}
                                    key={index}
                                    variants={fadeInAnimationVariants}
                                    initial="initial"
                                    whileInView="animate"
                                    viewport={{
                                        once: true,
                                    }}
                                    custom={index}
                                >
                                    {skill}
                                </motion.li>
                            ))}
                        </ul>
                    </React.Fragment>
                );
            })}
        </section>
    );
}
