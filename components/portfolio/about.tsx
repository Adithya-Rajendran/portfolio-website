"use client";

import SectionHeading from "../section-heading";
import { motion } from "motion/react";
import { useSectionInView } from "@/lib/hooks";
import {
    PortableText,
    type PortableTextBlock,
    type PortableTextComponents,
} from "@portabletext/react";

const portableTextComponents: PortableTextComponents = {
    block: {
        normal: ({ children }) => (
            <p className="mb-3 text-slate-600 dark:text-slate-300">
                {children}
            </p>
        ),
    },
    marks: {
        strong: ({ children }) => (
            <span className="font-semibold">{children}</span>
        ),
        em: ({ children }) => <span className="italic">{children}</span>,
        highlightEmerald: ({ children }) => (
            <span className="font-medium text-emerald-700 dark:text-emerald-400">
                {children}
            </span>
        ),
        highlightTeal: ({ children }) => (
            <span className="font-medium text-teal-700 dark:text-cyan-400">
                {children}
            </span>
        ),
        highlightOrange: ({ children }) => (
            <span className="font-medium text-orange-700 dark:text-orange-500">
                {children}
            </span>
        ),
        link: ({ children, value }) => (
            <a
                href={value?.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-700 hover:underline dark:text-emerald-400"
            >
                {children}
            </a>
        ),
    },
};

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
