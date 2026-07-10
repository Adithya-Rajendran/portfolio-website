import Project from "./project";
import SectionSpy from "./section-spy";
import TerminalSection from "@/components/terminal/terminal-section";
import type { Project as TProject } from "@/sanity.types";

interface ProjectsProps {
    projects: TProject[];
}

export default function Projects({ projects }: ProjectsProps) {
    return (
        <SectionSpy
            section="Projects"
            threshold={0.5}
            id="projects"
            className="scroll-mt-28"
        >
            <TerminalSection
                as="div"
                command="ls -l projects/"
                path="~/portfolio"
                label="Projects"
                storageId="portfolio-projects"
                promptClassName="mb-3"
            >
                {/* `ls -l`'s first output line — decorative terminal flavor */}
                <p
                    aria-hidden
                    className="font-term text-sm text-slate-500 dark:text-slate-400 mb-8"
                >
                    total {projects.length}
                </p>
                {projects.length === 0 ? (
                    <p className="font-term text-sm text-slate-500 dark:text-slate-400">
                        # nothing shipped from this directory yet — new builds
                        land here first
                    </p>
                ) : (
                    <ul className="grid gap-5 sm:gap-6 md:grid-cols-2">
                        {projects.map((project) => (
                            <li key={project._id} className="flex">
                                <Project {...project} />
                            </li>
                        ))}
                    </ul>
                )}
            </TerminalSection>
        </SectionSpy>
    );
}
