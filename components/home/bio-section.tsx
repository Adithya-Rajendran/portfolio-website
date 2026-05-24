import { PortableText, type PortableTextBlock } from "@portabletext/react";
import { createPortableTextStyles } from "@/lib/portable-text";
import RevealOnScroll from "@/components/reveal-on-scroll";

const homeBioComponents = createPortableTextStyles("homeBio");

interface BioSectionProps {
    homeBio?: PortableTextBlock[] | null;
}

export default function BioSection({ homeBio }: BioSectionProps) {
    return (
        <RevealOnScroll
            as="section"
            className="w-full max-w-3xl mx-auto px-4"
        >
            <div className="glass rounded-2xl px-7 py-10 sm:px-10 sm:py-12 relative overflow-hidden">
                <span
                    aria-hidden="true"
                    className="absolute -top-6 -left-2 font-display text-[10rem] leading-none text-accent opacity-10 select-none"
                >
                    &ldquo;
                </span>

                <div className="relative">
                    {homeBio ? (
                        <PortableText
                            value={homeBio}
                            components={homeBioComponents}
                        />
                    ) : (
                        <p className="text-lg leading-relaxed text-slate-700 dark:text-slate-300 text-center">
                            Hi, I&apos;m Adithya — Cloud Field Engineer at Canonical
                            with a deep interest in security and the systems
                            behind every clean abstraction.
                        </p>
                    )}
                </div>
            </div>
        </RevealOnScroll>
    );
}
