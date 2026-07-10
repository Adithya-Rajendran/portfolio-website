import { PortableText, type PortableTextBlock } from "@portabletext/react";
import { createPortableTextStyles } from "@/lib/portable-text";
import TerminalSection from "@/components/terminal/terminal-section";

const homeBioComponents = createPortableTextStyles("homeBio");

interface BioSectionProps {
    homeBio?: PortableTextBlock[] | null;
}

/**
 * `$ cat about.txt` — bio prose in Inter (mono is chrome, never body)
 * behind an accent rule, like quoted file output.
 */
export default function BioSection({ homeBio }: BioSectionProps) {
    return (
        <TerminalSection
            command="cat about.txt"
            label="About"
            storageId="bio"
            className="w-full max-w-6xl mx-auto px-6 sm:px-8"
        >
            <div className="max-w-[44rem] border-l-2 border-[rgb(var(--c1)/0.5)] pl-6 text-[1.05rem] leading-[1.8] text-slate-700 dark:text-slate-300 [&_p]:text-left">
                {homeBio ? (
                    <PortableText
                        value={homeBio}
                        components={homeBioComponents}
                    />
                ) : (
                    <p>
                        Hi, I&apos;m Adithya — Cloud Field Engineer at Canonical
                        with a deep interest in security and the systems behind
                        every clean abstraction.
                    </p>
                )}
            </div>
        </TerminalSection>
    );
}
