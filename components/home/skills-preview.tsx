import TerminalSection from "@/components/terminal/terminal-section";
import type { SkillCategory } from "@/sanity.types";

/** "Cybersecurity" -> "cybersecurity/", "What I use" -> "what-i-use/" */
function dirName(title: string): string {
    return `${title.toLowerCase().trim().replace(/\s+/g, "-")}/`;
}

/**
 * `$ tree skills/` — each Sanity skill category renders as a directory
 * listing with ├─/└─ branch glyphs (decorative; the category name is
 * the real heading).
 */
export default function SkillsPreview({
    skillCategories,
}: {
    skillCategories: SkillCategory[];
}) {
    if (skillCategories.length === 0) return null;

    return (
        <TerminalSection
            command="tree skills/ --dirs-first"
            label="Skills"
            className="w-full max-w-6xl mx-auto px-6 sm:px-8 pb-4"
        >
            <div className="grid gap-10 md:grid-cols-3">
                {skillCategories.map((category) => {
                    const skills = category.skills ?? [];
                    return (
                        <div key={category._id}>
                            <h3 className="font-term text-base font-bold text-accent mb-3">
                                {dirName(category.title ?? "")}
                            </h3>
                            <ul>
                                {skills.map((skill, i) => (
                                    <li
                                        key={skill}
                                        className="font-term text-[0.9rem] leading-8 text-slate-700 dark:text-slate-300"
                                    >
                                        <span
                                            aria-hidden
                                            className="text-slate-400/90 dark:text-slate-500/70"
                                        >
                                            {i === skills.length - 1
                                                ? "└─"
                                                : "├─"}
                                        </span>{" "}
                                        {skill}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </TerminalSection>
    );
}
