"use client";

import React from "react";
import SectionHeading from "../section-heading";
import { devSkillsData, devopskillsData, cyberSkillsData } from "@/lib/data";
import { useSectionInView } from "@/lib/hooks";
import { motion } from "motion/react";

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

export default function Skills() {
    const { ref } = useSectionInView("Skills");

    return (
        <section
            id="skills"
            ref={ref}
            className="mb-28 max-w-[53rem] scroll-mt-28 text-center sm:mb-40"
        >
            <SectionHeading>My skills</SectionHeading>
            <h3 className="text-xl font-medium capitalize my-4 text-center text-emerald-600 dark:text-emerald-400">
                Coding Skills
            </h3>
            <ul className="flex flex-wrap justify-center gap-2 text-lg text-slate-700">
                {devSkillsData.map((skill, index) => (
                    <motion.li
                        className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-5 py-3 dark:bg-white/5 dark:text-slate-300 dark:border-emerald-500/10"
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
            <h3 className="text-xl font-medium capitalize my-4 text-center text-cyan-600 dark:text-cyan-400">
                Cybersecurity Skills
            </h3>
            <ul className="flex flex-wrap justify-center gap-2 text-lg text-slate-700">
                {cyberSkillsData.map((skill, index) => (
                    <motion.li
                        className="bg-cyan-50 border border-cyan-200 text-cyan-800 rounded-xl px-5 py-3 dark:bg-white/5 dark:text-slate-300 dark:border-cyan-500/10"
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
            <h3 className="text-xl font-medium capitalize my-4 text-center text-violet-600 dark:text-violet-400">
                Infrastructure DevOps Skills
            </h3>
            <ul className="flex flex-wrap justify-center gap-2 text-lg text-slate-700">
                {devopskillsData.map((skill, index) => (
                    <motion.li
                        className="bg-violet-50 border border-violet-200 text-violet-800 rounded-xl px-5 py-3 dark:bg-white/5 dark:text-slate-300 dark:border-violet-500/10"
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
        </section>
    );
}
