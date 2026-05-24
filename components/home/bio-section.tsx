import { PortableText, type PortableTextBlock } from "@portabletext/react";
import { createPortableTextStyles } from "@/lib/portable-text";
import RevealOnScroll from "@/components/reveal-on-scroll";

const homeBioComponents = createPortableTextStyles("homeBio");

interface BioSectionProps {
    homeBio?: PortableTextBlock[] | null;
}

export default function BioSection({ homeBio }: BioSectionProps) {
    return (
        <RevealOnScroll as="section" className="max-w-[52rem] w-full py-20">
            {homeBio ? (
                <PortableText value={homeBio} components={homeBioComponents} />
            ) : (
                <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-400 text-center">
                    Hi, I&apos;m Adithya. I am a Cloud Field Engineer.
                </p>
            )}
        </RevealOnScroll>
    );
}
