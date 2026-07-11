import SectionHeading from "@/components/portfolio/section-heading";
import SectionSpy from "@/components/portfolio/section-spy";
import type { ProjectListItem } from "@/lib/sanity-client";
import Project from "@/components/portfolio/project";
import { hasVisibleItems } from "@/lib/content-rules";

export default function Projects({
    projects,
}: {
    projects: ProjectListItem[];
}) {
    if (!hasVisibleItems(projects)) return null;

    return (
        <SectionSpy
            section="Projects"
            threshold={0.2}
            id="projects"
            className="scroll-mt-32"
        >
            <SectionHeading
                title="Projects"
                description="Selected things I have built, investigated, or kept running. Each project opens into the fuller story."
            />
            <div className="grid gap-5 sm:grid-cols-2">
                {projects.map((project) => (
                    <Project key={project._id} project={project} />
                ))}
            </div>
        </SectionSpy>
    );
}
