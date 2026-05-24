"use client";

import { UserRound } from "lucide-react";
import { useSectionInView } from "@/lib/hooks";
import { PortableText, type PortableTextBlock } from "@portabletext/react";
import { createPortableTextStyles } from "@/lib/portable-text";
import { IconPill } from "@/components/ui/icon-pill";

const portableTextComponents = createPortableTextStyles("about");

interface AboutProps {
    body: PortableTextBlock[] | null;
}

/**
 * About is a single prose card — the title sits inside the card next
 * to a small icon-pill, so we don't end up with a large external
 * heading that competes with the fixed nav for visual weight.
 */
export default function About({ body }: AboutProps) {
    const { ref } = useSectionInView("About");

    return (
        <section
            ref={ref}
            id="about"
            className="scroll-mt-28 animate-slide-up"
            style={{ animationDelay: "175ms" }}
        >
            <div className="mx-auto max-w-3xl">
                <div className="os-card rounded-3xl p-7 sm:p-10">
                    <header className="flex items-center gap-4 mb-7 sm:mb-8">
                        <IconPill icon={UserRound} color="c1" size="md" />
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                                About
                            </p>
                            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
                                A bit about me
                            </h2>
                        </div>
                    </header>

                    <div className="text-base sm:text-lg leading-relaxed text-slate-700 dark:text-slate-300">
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
                    </div>
                </div>
            </div>
        </section>
    );
}
