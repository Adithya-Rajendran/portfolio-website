"use client";

import React from "react";
import Image from "next/image";
import SectionHeader from "@/components/section-header";
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

    // Latch a "visible" flag the first time the section enters the viewport
    // so each item can stagger in without re-firing on subsequent scrolls.
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
            className="scroll-mt-28"
        >
            <SectionHeader
                eyebrow="Experience"
                title="Where I've worked"
                description="The roles and chapters that shaped how I build."
            />

            <ol className="relative">
                {/* Vertical spine — sits behind the icon dots */}
                <div
                    aria-hidden="true"
                    className="absolute top-2 bottom-2 w-px left-[15px] bg-gradient-to-b from-transparent via-emerald-200 to-transparent dark:via-emerald-500/20"
                />

                {experiences.map((item, i) => (
                    <li
                        key={item._id}
                        className={cn(
                            "relative pl-12 pb-10 last:pb-0",
                            "transition-all duration-500 ease-out",
                            isVisible
                                ? "opacity-100 translate-y-0"
                                : "opacity-0 translate-y-4",
                        )}
                        style={{
                            transitionDelay: isVisible
                                ? `${Math.min(i * 90, 540)}ms`
                                : "0ms",
                        }}
                    >
                        {/* Icon dot on the spine */}
                        <div className="absolute z-10 top-0 left-0 w-8 h-8 rounded-full bg-white dark:bg-[#0a0f1a] border-2 border-emerald-300 dark:border-emerald-500/40 flex items-center justify-center overflow-hidden">
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
                            ) : (
                                <span
                                    aria-hidden="true"
                                    className="w-2 h-2 rounded-full bg-emerald-500"
                                />
                            )}
                        </div>

                        <article>
                            {item.date && (
                                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">
                                    {item.date}
                                </p>
                            )}
                            <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100">
                                {item.title || ""}
                            </h3>
                            {(item.org || item.location) && (
                                <p className="mt-1 text-sm sm:text-base text-slate-600 dark:text-slate-400">
                                    {[item.org, item.location]
                                        .filter(Boolean)
                                        .join(" · ")}
                                </p>
                            )}
                            {item.description && item.description.length > 0 && (
                                <ul className="mt-3 space-y-1.5 text-sm sm:text-base text-slate-600 dark:text-slate-400 list-disc pl-5 marker:text-emerald-500/60">
                                    {item.description.map((desc, idx) => (
                                        <li key={idx} className="leading-relaxed">
                                            {desc}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </article>
                    </li>
                ))}
            </ol>
        </section>
    );
}
