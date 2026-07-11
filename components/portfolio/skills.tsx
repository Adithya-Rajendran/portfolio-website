import SectionSpy from "@/components/portfolio/section-spy";
import TerminalSection from "@/components/terminal/terminal-section";
import RevealOnScroll from "@/components/reveal-on-scroll";
import { styleForVariant } from "@/lib/variant-styles";
import type { SkillCategory } from "@/sanity.types";

/** "Cybersecurity" -> "cybersecurity/" — mirrors home's skills tree. */
function dirName(title: string): string {
    return `${title.toLowerCase().trim().replace(/\s+/g, "-")}/`;
}

interface SkillsProps {
    skillCategories: SkillCategory[];
}

/**
 * `$ tree skills/` — each Sanity category is a directory (mono heading
 * in its variant accent) above hairline-ruled rows of bracket chips.
 * Distinct from home's preview (branch-glyph listing): the portfolio
 * shows the full inventory as chips.
 *
 * Server component — the markup ships zero hydration JS. SectionSpy
 * wires the header nav highlight; RevealOnScroll staggers the groups in.
 */
export default function Skills({ skillCategories }: SkillsProps) {
    return (
        <SectionSpy section="Skills" id="skills" className="scroll-mt-28">
            <TerminalSection
                as="div"
                command="tree skills/ --dirs-first"
                path="~/portfolio"
                label="Skills"
                promptClassName="mb-10"
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-10">
                    {skillCategories.map((category, i) => {
                        const styles = styleForVariant(category.colorVariant);
                        return (
                            <RevealOnScroll
                                key={category._id}
                                delayMs={Math.min(i * 90, 360)}
                                className="border-t border-slate-400/25 dark:border-white/10 pt-5"
                            >
                                <h3
                                    className={`font-term text-base font-bold ${styles.textColor} mb-4`}
                                >
                                    {dirName(category.title ?? "")}
                                </h3>
                                <ul className="flex flex-wrap gap-x-4 gap-y-2.5">
                                    {(category.skills || []).map(
                                        (skill, index) => (
                                            <li
                                                key={index}
                                                className="font-term text-[0.85rem] whitespace-nowrap text-slate-700 dark:text-slate-300"
                                            >
                                                <span aria-hidden>[ </span>
                                                {skill}
                                                <span aria-hidden> ]</span>
                                            </li>
                                        ),
                                    )}
                                </ul>
                            </RevealOnScroll>
                        );
                    })}
                </div>
            </TerminalSection>
        </SectionSpy>
    );
}
