"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "motion/react";
import { Card } from "@/components/ui/card";
import { urlForImage } from "@/lib/sanity-image";
import type { Project as TProject } from "@/sanity.types";

export default function Project({
    title,
    description,
    tags,
    image,
    linkTitle,
    linkUrl,
}: TProject) {
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["0 1", "1.33 1"],
    });
    const scaleProgress = useTransform(scrollYProgress, [0, 1], [0.94, 1]);
    const opacityProgress = useTransform(scrollYProgress, [0, 1], [0.55, 1]);

    const imageUrl = image
        ? urlForImage(image).width(900).quality(95).url()
        : null;

    return (
        <motion.div
            ref={ref}
            style={{ scale: scaleProgress, opacity: opacityProgress }}
            className="w-full"
        >
            <Card flush className="h-full flex flex-col overflow-hidden">
                {imageUrl && (
                    <div className="relative aspect-[16/10] overflow-hidden bg-accent-soft">
                        <Image
                            src={imageUrl}
                            alt={image?.alt || `Screenshot of ${title || ""}`}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 600px"
                            loading="lazy"
                            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                        />
                        <div
                            aria-hidden="true"
                            className="absolute inset-0 bg-gradient-to-t from-white/40 via-transparent to-transparent dark:from-[#0a0c1a]/60"
                        />
                    </div>
                )}
                <div className="flex flex-col flex-1 p-6 sm:p-7">
                    <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-white group-hover:text-accent transition-colors">
                        {title || ""}
                    </h3>
                    {description && (
                        <p className="mt-2 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-400">
                            {description}
                        </p>
                    )}
                    {linkTitle && linkUrl && (
                        <a
                            href={linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex w-fit text-sm font-medium text-accent hover:opacity-80 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {linkTitle} →
                        </a>
                    )}
                    {tags && tags.length > 0 && (
                        <ul
                            className="flex flex-wrap mt-5 gap-1.5 sm:mt-auto sm:pt-5"
                            aria-label="Related skills"
                        >
                            {tags.map((tag, index) => (
                                <li
                                    key={index}
                                    className="rounded-full border border-accent-soft bg-accent-soft px-2.5 py-0.5 text-[0.7rem] font-medium uppercase tracking-wider text-accent"
                                >
                                    {tag}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </Card>
        </motion.div>
    );
}
