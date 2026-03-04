"use client";

import { motion } from "motion/react";
import { PortableText, type PortableTextBlock } from "@portabletext/react";
import { homeBioComponents } from "./constants";

interface BioSectionProps {
    homeBio?: PortableTextBlock[] | null;
}

export default function BioSection({ homeBio }: BioSectionProps) {
    return (
        <motion.section
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="max-w-[52rem] w-full py-20"
        >
            {homeBio ? (
                <PortableText value={homeBio} components={homeBioComponents} />
            ) : (
                <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-400 text-center">
                    Hi, I&apos;m Adithya. I am a Cloud Field Engineer.
                </p>
            )}
        </motion.section>
    );
}
