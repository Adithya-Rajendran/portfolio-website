import CareerSectionHeading from "@/components/portfolio/section-heading";
import SectionSpy from "@/components/portfolio/section-spy";
import type { SkillGroup } from "@/lib/sanity-client";

export default function Skills({ groups }: { groups: SkillGroup[] }) {
    if (!groups.length) return null;
    return (
        <SectionSpy section="Skills" id="skills" className="career-section">
            <CareerSectionHeading
                title="Tools & systems"
                description="The platforms and practices behind the work."
            />
            <div className="career-skill-groups">
                {groups.map((group) => (
                    <article key={group._key}>
                        <h3>{group.title}</h3>
                        <ul>
                            {group.skills.map((skill) => (
                                <li key={skill}>{skill}</li>
                            ))}
                        </ul>
                    </article>
                ))}
            </div>
        </SectionSpy>
    );
}
