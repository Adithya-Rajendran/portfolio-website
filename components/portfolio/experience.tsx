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
        <section id="experience" ref={setRefs} className="scroll-mt-28">
            <SectionHeader
                eyebrow="Experience"
                title="Where I've worked"
                description="The roles and chapters that shaped how I build."
            />

            <ol className="relative">
                <div
                    aria-hidden="true"
                    className="absolute top-3 bottom-3 w-px left-[19px] bg-accent-gradient-vertical opacity-30"
                />

                {experiences.map((item, i) => (
                    <li
                        key={item._id}
                        className={cn(
                            "relative pl-16 pb-10 last:pb-0",
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
                        <div className="absolute top-0 left-0 z-10">
                            <div
                                aria-hidden="true"
                                className="absolute inset-0 rounded-full bg-accent-halo opacity-30 blur-md"
                            />
                            <div className="glass relative w-10 h-10 rounded-full flex items-center justify-center overflow-hidden">
                                {item.icon ? (
                                    <Image
                                        src={urlForImage(item.icon)
                                            .width(60)
                                            .height(60)
                                            .url()}
                                        alt={item.icon.alt || item.title || ""}
                                        width={22}
                                        height={22}
                                        sizes="22px"
                                        className="object-contain"
                                    />
                                ) : (
                                    <span
                                        aria-hidden="true"
                                        className="w-2 h-2 rounded-full bg-accent-gradient"
                                    />
                                )}
                            </div>
                        </div>

                        <article className="glass rounded-2xl p-5 sm:p-6">
                            {item.date && (
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent mb-2">
                                    {item.date}
                                </p>
                            )}
                            <h3 className="font-display text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">
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
                                <ul className="mt-3 space-y-1.5 text-sm sm:text-base text-slate-600 dark:text-slate-300 list-disc pl-5 marker:text-accent">
                                    {item.description.map((desc, idx) => (
                                        <li
                                            key={idx}
                                            className="leading-relaxed"
                                        >
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
