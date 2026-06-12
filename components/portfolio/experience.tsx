"use client";

import Image from "next/image";
import SectionHeader from "@/components/section-header";
import { useSectionReveal } from "@/lib/hooks";
import { urlForImage } from "@/lib/sanity-image";
import { cn } from "@/lib/utils";
import type { Experience as TExperience } from "@/sanity.types";

interface ExperienceProps {
    experiences: TExperience[];
}

/**
 * Experience as a vertical timeline. Each item is its own card so the
 * pattern matches the unified surface style used elsewhere on the page.
 */
export default function Experience({ experiences }: ExperienceProps) {
    const { ref, inView: isVisible } = useSectionReveal("Experience", {
        spyThreshold: 0.3,
    });

    return (
        <section id="experience" ref={ref} className="scroll-mt-28">
            <SectionHeader
                eyebrow="Experience"
                title="Where I've worked"
                description="The roles and chapters that shaped how I build."
            />

            <ol className="relative space-y-5">
                <div
                    aria-hidden
                    className="absolute top-6 bottom-6 w-px left-[23px] bg-accent-gradient-vertical opacity-25"
                />

                {experiences.map((item, i) => (
                    <li
                        key={item._id}
                        className={cn(
                            "relative pl-16",
                            "motion-safe:transition-all motion-safe:duration-500 motion-safe:ease-out",
                            !isVisible &&
                                "motion-safe:opacity-0 motion-safe:translate-y-4",
                        )}
                        style={{
                            transitionDelay: isVisible
                                ? `${Math.min(i * 90, 540)}ms`
                                : "0ms",
                        }}
                    >
                        {/* Squircle icon dot on the spine */}
                        <div className="absolute top-5 left-0 z-10">
                            <div
                                aria-hidden
                                className="absolute inset-0 rounded-full bg-accent-halo opacity-25 blur-md"
                            />
                            <div className="os-card relative w-12 h-12 rounded-full flex items-center justify-center overflow-hidden">
                                {item.icon ? (
                                    <Image
                                        src={urlForImage(item.icon)
                                            .width(60)
                                            .height(60)
                                            .url()}
                                        alt={item.icon.alt || item.title || ""}
                                        width={26}
                                        height={26}
                                        sizes="26px"
                                        className="object-contain"
                                    />
                                ) : (
                                    <span
                                        aria-hidden
                                        className="w-2.5 h-2.5 rounded-full bg-accent-gradient"
                                    />
                                )}
                            </div>
                        </div>

                        <article className="os-card p-5 sm:p-6">
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
                            {item.description &&
                                item.description.length > 0 && (
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
