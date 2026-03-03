"use client";

import React from "react";
import { useSectionInView } from "@/lib/hooks";
import SectionHeading from "../section-heading";
import Project from "./project";
import type { Project as TProject } from "@/sanity.types";

interface ProjectsProps {
    projects: TProject[];
}

export default function Projects({ projects }: ProjectsProps) {
    const { ref } = useSectionInView("Projects", 0.5);

    return (
        <section ref={ref} id="projects" className="scroll-mt-28 mb-28">
            <SectionHeading>My projects</SectionHeading>
            <div>
                {projects.map((project) => (
                    <Project key={project._id} {...project} />
                ))}
            </div>
        </section>
    );
}
