"use client";

import SectionHeader from "@/components/section-header";
import { useSectionInView } from "@/lib/hooks";
import { PortableText, type PortableTextBlock } from "@portabletext/react";
import { createPortableTextStyles } from "@/lib/portable-text";

const portableTextComponents = createPortableTextStyles("about");

interface AboutProps {
    body: PortableTextBlock[] | null;
}

export default function About({ body }: AboutProps) {
    const { ref } = useSectionInView("About");

    return (
        <section
            ref={ref}
            id="about"
            className="scroll-mt-28 animate-slide-up"
            style={{ animationDelay: "175ms" }}
        >
            <SectionHeader
                eyebrow="About"
                title="A bit about me"
                align="center"
            />
            <div className="mx-auto max-w-2xl text-center text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-300">
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
        </section>
    );
}
