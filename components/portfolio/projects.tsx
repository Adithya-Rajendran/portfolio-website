import CareerSectionHeading from "@/components/portfolio/section-heading";
import SectionSpy from "@/components/portfolio/section-spy";
import type { ProjectListItem } from "@/lib/sanity-client";
import Project from "@/components/portfolio/project";

export default function Projects({
    projects,
}: {
    projects: ProjectListItem[];
}) {
    if (!projects.length) return null;
    return (
        <SectionSpy
            section="Projects"
            threshold={0.2}
            id="projects"
            className="career-section"
        >
            <CareerSectionHeading
                title="Selected work"
                description="Things I have built, investigated, and kept running."
            />
            <div className="career-project-grid">
                {projects.map((project) => (
                    <Project key={project._id} project={project} />
                ))}
            </div>
        </SectionSpy>
    );
}
