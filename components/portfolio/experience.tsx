import Image from "next/image";
import SectionSpy from "@/components/portfolio/section-spy";
import TerminalSection from "@/components/terminal/terminal-section";
import RevealOnScroll from "@/components/reveal-on-scroll";
import { urlForImage } from "@/lib/sanity-image";
import type { Experience as TExperience } from "@/sanity.types";

interface ExperienceProps {
    experiences: TExperience[];
}

/**
 * Experience as a vertical timeline behind a `$ cat experience.log`
 * prompt. The timeline mechanics (spine, icon dots, staggered reveal)
 * are unchanged from the pre-terminal design; the card chrome is
 * tempered — hairline borders instead of glass, mono date labels.
 *
 * Server component — SectionSpy handles the nav highlight (0.3 threshold:
 * the timeline is tall, 75% visibility never triggers on short viewports)
 * and each item reveals through the shared RevealOnScroll wrapper.
 */
export default function Experience({ experiences }: ExperienceProps) {
    return (
        <SectionSpy
            section="Experience"
            threshold={0.3}
            id="experience"
            className="scroll-mt-28"
        >
            <TerminalSection
                as="div"
                command="cat experience.log"
                path="~/portfolio"
                label="Experience"
                promptClassName="mb-10"
            >
                <ol className="relative space-y-5">
                    <div
                        aria-hidden
                        className="absolute top-6 bottom-6 w-px left-[23px] bg-accent-gradient-vertical opacity-25"
                    />

                    {experiences.map((item, i) => (
                        <RevealOnScroll
                            as="li"
                            key={item._id}
                            delayMs={Math.min(i * 90, 540)}
                            className="relative pl-16"
                        >
                            {/* Squircle icon dot on the spine */}
                            <div className="absolute top-5 left-0 z-10">
                                <div className="os-card relative w-12 h-12 rounded-full flex items-center justify-center overflow-hidden">
                                    {item.icon ? (
                                        <Image
                                            src={urlForImage(item.icon)
                                                .width(60)
                                                .height(60)
                                                .url()}
                                            alt={
                                                item.icon.alt ||
                                                item.title ||
                                                ""
                                            }
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

                            <article className="rounded-card border border-slate-400/25 dark:border-white/10 p-5 sm:p-6">
                                {item.date && (
                                    <p className="font-term text-[0.8rem] tabular-nums text-accent mb-2">
                                        {item.date}
                                    </p>
                                )}
                                <h3 className="font-display text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">
                                    {item.title || ""}
                                </h3>
                                {(item.org || item.location) && (
                                    <p className="mt-1 font-term text-[0.8rem] text-slate-600 dark:text-slate-400">
                                        {[item.org, item.location]
                                            .filter(Boolean)
                                            .join(" · ")}
                                    </p>
                                )}
                                {item.description &&
                                    item.description.length > 0 && (
                                        <ul className="mt-3 space-y-1.5 text-sm sm:text-base text-slate-600 dark:text-slate-300 list-disc pl-5 marker:text-accent">
                                            {item.description.map(
                                                (desc, idx) => (
                                                    <li
                                                        key={idx}
                                                        className="leading-relaxed"
                                                    >
                                                        {desc}
                                                    </li>
                                                ),
                                            )}
                                        </ul>
                                    )}
                            </article>
                        </RevealOnScroll>
                    ))}
                </ol>
            </TerminalSection>
        </SectionSpy>
    );
}
