import { PortableText, type PortableTextBlock } from "@portabletext/react";
import { createPortableTextStyles } from "@/lib/portable-text";
import RevealOnScroll from "@/components/reveal-on-scroll";

const homeBioComponents = createPortableTextStyles("homeBio");

interface BioSectionProps {
    homeBio?: PortableTextBlock[] | null;
}

export default function BioSection({ homeBio }: BioSectionProps) {
    return (
        <RevealOnScroll as="section" className="w-full max-w-3xl mx-auto px-4">
            <div className="os-card rounded-3xl px-7 py-10 sm:px-10 sm:py-12">
                {homeBio ? (
                    <PortableText
                        value={homeBio}
                        components={homeBioComponents}
                    />
                ) : (
                    <p className="text-lg leading-relaxed text-slate-700 dark:text-slate-300 text-center">
                        Hi, I&apos;m Adithya — Cloud Field Engineer at Canonical
                        with a deep interest in security and the systems behind
                        every clean abstraction.
                    </p>
                )}
            </div>
        </RevealOnScroll>
    );
}
