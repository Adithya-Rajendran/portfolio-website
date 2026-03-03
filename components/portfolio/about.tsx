"use client";

import SectionHeading from "../section-heading";
import { motion } from "motion/react";
import { useSectionInView } from "@/lib/hooks";

export default function About() {
    const { ref } = useSectionInView("About");

    return (
        <motion.section
            ref={ref}
            className="mb-28 max-w-[45rem] text-center leading-8 sm:mb-40 scroll-mt-28"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.175 }}
            id="about"
        >
            <SectionHeading>About me</SectionHeading>
            <p className="mb-3 text-slate-600 dark:text-slate-300">
                After earning my degree from{" "}
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    University of California, Santa Cruz
                </span>
                , I've been advancing my career in cloud engineering and
                cybersecurity. In my current role as a{" "}
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    Cloud Field Engineer
                </span>
                at{" "}
                <span className="font-medium text-orange-700 dark:text-orange-500">
                    Canonical
                </span>
                , I focus on deploying scalable infrastructure solutions using
                technologies like{" "}
                <span className="font-medium text-teal-700 dark:text-cyan-400">
                    Kubernetes
                </span>
                ,{" "}
                <span className="font-medium text-teal-700 dark:text-cyan-400">
                    OpenStack
                </span>
                ,{" "}
                <span className="font-medium text-teal-700 dark:text-cyan-400">
                    Ceph
                </span>
                , and{" "}
                <span className="font-medium text-teal-700 dark:text-cyan-400">
                    Ubuntu
                </span>
                . My work involves optimizing performance, automating
                deployments, applying any security hardening, and ensuring
                stable cloud environments.
            </p>

            <p className="text-slate-600 dark:text-slate-300">
                <span className="italic">Beyond engineering</span>, I enjoy
                watching documentaries and experimenting with new technologies
                in my home lab. I'm always eager to{" "}
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    master new skills
                </span>
                , currently diving deeper into areas like{" "}
                <span className="font-medium text-teal-700 dark:text-cyan-400">
                    compliance rules
                </span>{" "}
                and{" "}
                <span className="font-medium text-teal-700 dark:text-cyan-400">
                    AI/ML security
                </span>
                , which continually fuel my passion for solving complex
                challenges.
            </p>
        </motion.section>
    );
}
