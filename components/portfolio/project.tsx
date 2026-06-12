"use client";

import Image from "next/image";
import { useInView } from "react-intersection-observer";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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
    const { ref, inView } = useInView({
        threshold: 0.15,
        triggerOnce: true,
        fallbackInView: true,
    });

    const imageUrl = image
        ? urlForImage(image).width(900).quality(95).url()
        : null;

    return (
        <div
            ref={ref}
            className={cn(
                "w-full",
                "motion-safe:transition-all motion-safe:duration-500 motion-safe:ease-out",
                !inView && "motion-safe:opacity-0 motion-safe:translate-y-4",
            )}
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
                            className="absolute inset-0 bg-gradient-to-t from-white/40 via-transparent to-transparent dark:from-canvas-dark/60"
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
        </div>
    );
}
