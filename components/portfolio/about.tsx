"use client";

import SectionHeading from "../section-heading";
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
            style={{ animationDelay: "175ms" }}
            className="mb-28 max-w-[45rem] text-center leading-8 sm:mb-40 scroll-mt-28 animate-slide-up"
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
        </section>
    );
}
