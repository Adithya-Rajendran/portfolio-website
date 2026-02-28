"use client";

import { useRef } from "react";
import { projectsData } from "@/lib/data";
import Image from "next/image";
import { motion, useScroll, useTransform } from "motion/react";

type ProjectProps = (typeof projectsData)[number];

export default function Project({
    title,
    description,
    tags,
    imageUrl,
    link,
}: ProjectProps) {
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["0 1", "1.33 1"],
    });
    const scaleProgress = useTransform(scrollYProgress, [0, 1], [0.8, 1]);
    const opacityProgress = useTransform(scrollYProgress, [0, 1], [0.6, 1]);

    return (
        <motion.div
            ref={ref}
            style={{
                scale: scaleProgress,
                opacity: opacityProgress,
            }}
            className="group mb-3 sm:mb-8 last:mb-0"
        >
            <section className="bg-slate-50 max-w-[42rem] border border-slate-200 rounded-lg overflow-hidden sm:pr-8 relative hover:bg-slate-100 transition sm:group-even:pl-8 dark:text-slate-200 dark:bg-white/[0.03] dark:border-white/8 dark:hover:bg-white/[0.06]">
                <div className="pt-4 pb-7 px-5 sm:pl-10 sm:pr-2 sm:pt-10 sm:max-w-[50%] flex flex-col h-full sm:group-even:ml-[18rem]">
                    <h3 className="text-2xl font-semibold">{title}</h3>
                    <p className="my-2 leading-relaxed text-slate-600 dark:text-slate-400">
                        {description}
                    </p>
                    {link ? (
                        <a
                            className="text-emerald-700 hover:underline hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 mb-2 transition-colors"
                            href={link.link}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {link.title}
                        </a>
                    ) : null}
                    <ul
                        className="flex flex-wrap mt-4 gap-2 sm:mt-auto"
                        aria-label="Related Skills"
                    >
                        {tags.map((tag, index) => (
                            <li
                                className="bg-slate-800 dark:bg-emerald-500/10 px-3 py-1 text-[0.7rem] uppercase tracking-wider text-white dark:text-emerald-400 rounded-full border border-transparent dark:border-emerald-500/20"
                                key={index}
                            >
                                {tag}
                            </li>
                        ))}
                    </ul>
                </div>

                <Image
                    src={imageUrl}
                    alt={`Screenshot of ${title}`}
                    quality={95}
                    loading="lazy"
                    className="absolute hidden sm:block top-8 -right-40 w-[28.25rem] rounded-t-lg shadow-2xl
        transition 
        group-hover:scale-[1.04]
        group-hover:-translate-x-3
        group-hover:translate-y-3
        group-hover:-rotate-2

        group-even:group-hover:translate-x-3
        group-even:group-hover:translate-y-3
        group-even:group-hover:rotate-2

        group-even:right-[initial] group-even:-left-40"
                />
            </section>
        </motion.div>
    );
}
