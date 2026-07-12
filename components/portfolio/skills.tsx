import { SectionHeading } from "@/components/section-heading";
import SectionSpy from "@/components/portfolio/section-spy";
import type { SkillGroup } from "@/lib/sanity-client";

export default function Skills({ groups }: { groups: SkillGroup[] }) {
    if (groups.length === 0) return null;

    return (
        <SectionSpy section="Skills" id="skills" className="scroll-mt-32">
            <SectionHeading
                title="Skills"
                description="The platforms, tools, and practices I use often enough to keep close."
            />
            <div className="grid border-t border-slate-300/70 dark:border-white/10 sm:grid-cols-2">
                {groups.map((group) => (
                    <article
                        key={group._key}
                        className="border-b border-slate-300/70 py-6 dark:border-white/10 sm:odd:pr-8 sm:even:border-l sm:even:pl-8"
                    >
                        <h3 className="font-display text-xl font-semibold tracking-[-0.025em] text-slate-950 dark:text-white">
                            {group.title}
                        </h3>
                        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-3">
                            {group.skills.map((skill) => (
                                <li
                                    key={skill}
                                    className="font-term text-xs leading-5 text-slate-600 dark:text-slate-300"
                                >
                                    <span aria-hidden className="text-accent">
                                        /
                                    </span>{" "}
                                    {skill}
                                </li>
                            ))}
                        </ul>
                    </article>
                ))}
            </div>
        </SectionSpy>
    );
}
