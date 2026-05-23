"use client";

import SectionHeading from "../section-heading";
import { motion } from "motion/react";
import { useSectionInView } from "@/lib/hooks";
import { PortableText, type PortableTextBlock } from "@portabletext/react";
import { createPortableTextStyles } from "@/lib/portable-text";

const portableTextComponents = createPortableTextStyles("about");

interface AboutProps {
    body: PortableTextBlock[] | null;
}

export default function About({ body }: AboutProps) {
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
            {body ? (
                <PortableText
                    value={body}
                    components={portableTextComponents}
                />
            ) : (
                <p className="text-slate-500 dark:text-slate-400">
                    About content coming soon.
                </p>
            )}
        </motion.section>
    );
}
