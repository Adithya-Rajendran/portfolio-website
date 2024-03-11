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
                After earning my degree from{" "}
                <span className="font-medium">
                    University of California, Santa Cruz
                </span>
                , my journey in cybersecurity and software development deepened.
                I've earned{" "}
                <span className="font-medium">CompTIA Security+</span> and{" "}
                <span className="font-medium">AWS Solutions Architect</span>{" "}
                certifications, and I'm on my path to the OSCP. What drives me
                is the{" "}
                <span className="italic">joy of solving complex problems</span>
                —there's nothing like the thrill of a breakthrough. Currently, I
                am seeking{" "}
                <span className="font-medium">full-time opportunities</span> in
                the software development or cybersecurity space, I'm eager to
                bring my passion and expertise to your team.
            </p>

            <p>
                <span className="italic">Beyond coding</span>, my leisure
                activities include watching documentaries,
                and experimenting with new technologies in my home lab. I'm
                always on the lookout for{" "}
                <span className="font-medium">new skills to master</span>.
                Lately, I've been diving into{" "}
                <span className="font-medium">ethical hacking</span> and{" "}
                <span className="font-medium">network security</span>, expanding
                my understanding and capabilities in cybersecurity.
            </p>
        </motion.section>
    );
}
