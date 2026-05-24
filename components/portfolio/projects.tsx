"use client";

import React from "react";
import { useSectionInView } from "@/lib/hooks";
import SectionHeader from "@/components/section-header";
import Project from "./project";
import type { Project as TProject } from "@/sanity.types";

interface ProjectsProps {
    projects: TProject[];
}

export default function Projects({ projects }: ProjectsProps) {
    const { ref } = useSectionInView("Projects", 0.5);

    return (
        <section ref={ref} id="projects" className="scroll-mt-28">
            <SectionHeader
                eyebrow="Projects"
                title="Things I've built"
                description="A selection of side projects, experiments, and tools."
            />
            <ul className="grid gap-5 sm:gap-6 md:grid-cols-2">
                {projects.map((project) => (
                    <li key={project._id} className="flex">
                        <Project {...project} />
                    </li>
                ))}
            </ul>
        </section>
    );
}
