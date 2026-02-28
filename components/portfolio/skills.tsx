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
            <h3 className="text-xl font-medium capitalize my-4 text-center text-violet-700 dark:text-violet-400">
                Coding Skills
            </h3>
            <ul className="flex flex-wrap justify-center gap-2 text-lg text-gray-800">
                {devSkillsData.map((skill, index) => (
                    <motion.li
                        className="bg-white borderBlack rounded-xl px-5 py-3 dark:bg-white/10 dark:text-white/80"
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
            <h3 className="text-xl font-medium capitalize my-4 text-center text-orange-700 dark:text-cyan-500">
                Cybersecurity Skills
            </h3>
            <ul className="flex flex-wrap justify-center gap-2 text-lg text-gray-800">
                {cyberSkillsData.map((skill, index) => (
                    <motion.li
                        className="bg-white borderBlack rounded-xl px-5 py-3 dark:bg-white/10 dark:text-white/80"
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
            <h3 className="text-xl font-medium capitalize my-4 text-center text-emerald-600 dark:text-emerald-500">
                Infrastructure DevOps Skills
            </h3>
            <ul className="flex flex-wrap justify-center gap-2 text-lg text-gray-800">
                {devopskillsData.map((skill, index) => (
                    <motion.li
                        className="bg-white borderBlack rounded-xl px-5 py-3 dark:bg-white/10 dark:text-white/80"
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
