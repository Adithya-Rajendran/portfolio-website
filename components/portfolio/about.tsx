"use client";

import SectionHeading from "../section-heading";
import { motion } from "framer-motion";
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
            <p className="mb-3">
                After graduating from the{" "}
                <span className="font-medium">
                    University of California, Santa Cruz
                </span>
                , I continued my passion for cybersecurity and programming. I
                obtained industry-standard certifications namely,{" "}
                <span className="font-medium">CompTIA Security+</span>. and{" "}
                <span className="font-medium">AWS Solutions Architect</span>.{" "}
                I'm actively working towards obtaining the OffSec Certified
                Professional (OSCP) certification.{" "}
                <span className="italic">My favorite part of computing</span> is
                the problem-solving aspect. I{" "}
                <span className="underline">love</span> the feeling of figuring
                out a solution to a problem. Currently, I am seeking a{" "}
                <span className="font-medium">full-time opportunity</span> and I
                invite you to review my projects and experience to see how my
                passion for technology and problem-solving can contribute to
                your team.
            </p>

            <p>
                <span className="italic">Aside from coding</span>, I enjoy
                playing video games, watching movies, and tinkering in my
                home-lab. I also enjoy{" "}
                <span className="font-medium">learning new things</span>. I am
                currently learning about{" "}
                <span className="font-medium">photography</span>.
            </p>
        </motion.section>
    );
}
