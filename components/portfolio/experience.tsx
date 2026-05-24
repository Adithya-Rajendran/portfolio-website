"use client";

import React from "react";
import Image from "next/image";
import SectionHeading from "../section-heading";
import { useInView } from "react-intersection-observer";
import { useSectionInView } from "@/lib/hooks";
import { urlForImage } from "@/lib/sanity-image";
import { cn } from "@/lib/utils";
import type { Experience as TExperience } from "@/sanity.types";

interface ExperienceProps {
    experiences: TExperience[];
}

export default function Experience({ experiences }: ExperienceProps) {
    const { ref: sectionRef } = useSectionInView("Experience", 0.3);

    // Latch on first scroll-in: drives a one-shot staggered fade for each
    // entry. triggerOnce keeps isVisible true after the section leaves view.
    const { ref: visibilityRef, inView: isVisible } = useInView({
        threshold: 0.15,
        triggerOnce: true,
    });

    const setRefs = React.useCallback(
        (node: HTMLElement | null) => {
            sectionRef(node);
            visibilityRef(node);
        },
        [sectionRef, visibilityRef],
    );

    return (
        <section
            id="experience"
            ref={setRefs}
            className="scroll-mt-28 mb-28 sm:mb-40"
        >
            <SectionHeading>My experience</SectionHeading>

            <ol className="relative mx-auto max-w-5xl">
                {/* Vertical spine — left-aligned on mobile, centered on desktop */}
                <div
                    aria-hidden="true"
                    className="absolute top-0 bottom-0 w-0.5 left-4 sm:left-1/2 sm:-translate-x-px bg-emerald-200 dark:bg-emerald-500/20"
                />

                {experiences.map((item, i) => {
                    const isLeft = i % 2 === 0;
                    return (
                        <li
                            key={item._id}
                            className={cn(
                                "relative pl-12 sm:pl-0 mb-10 last:mb-0",
                                "motion-safe:transition-[opacity,transform] motion-safe:duration-500 motion-safe:ease-out",
                                isVisible
                                    ? "opacity-100 translate-y-0"
                                    : "opacity-0 translate-y-6",
                            )}
                            style={{
                                transitionDelay: isVisible
                                    ? `${Math.min(i * 90, 600)}ms`
                                    : "0ms",
                            }}
                        >
                            {/* Icon circle on the spine */}
                            <div className="absolute z-10 top-0 left-0 sm:left-1/2 sm:-translate-x-1/2 w-8 h-8 rounded-full bg-emerald-50 dark:bg-white/5 border-2 border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                                {item.icon ? (
                                    <Image
                                        src={urlForImage(item.icon)
                                            .width(60)
                                            .height(60)
                                            .url()}
                                        alt={item.icon.alt || item.title || ""}
                                        width={20}
                                        height={20}
                                        sizes="20px"
                                        className="object-contain"
                                    />
                                ) : null}
                            </div>

                            {/* Card — full width on mobile (right of spine);
                                desktop alternates sides */}
                            <article
                                className={cn(
                                    "rounded-lg border p-5 bg-white dark:bg-white/[0.03] border-emerald-200 dark:border-white/10",
                                    "sm:w-[calc(50%-2.5rem)]",
                                    isLeft
                                        ? "sm:ml-0 sm:mr-auto sm:text-right"
                                        : "sm:ml-auto sm:mr-0 sm:text-left",
                                )}
                            >
                                {item.date && (
                                    <p className="text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2">
                                        {item.date}
                                    </p>
                                )}
                                <h3 className="font-semibold capitalize text-slate-900 dark:text-slate-100">
                                    {item.title || ""}
                                </h3>
                                {item.org && (
                                    <p className="text-sm text-slate-700 dark:text-slate-300">
                                        {item.org}
                                    </p>
                                )}
                                {item.location && (
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                        {item.location}
                                    </p>
                                )}
                                {item.description && item.description.length > 0 && (
                                    <ul className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                                        {item.description.map((desc, idx) => (
                                            <li key={idx}>{`• ${desc}`}</li>
                                        ))}
                                    </ul>
                                )}
                            </article>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}
