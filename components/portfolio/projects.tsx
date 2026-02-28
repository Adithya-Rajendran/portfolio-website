"use client";

import React from "react";
import { projectsData } from "@/lib/data";
import { useSectionInView } from "@/lib/hooks";
import SectionHeading from "../section-heading";
import Project from "./project";

export default function Projects() {
    const { ref } = useSectionInView("Projects", 0.5);

    return (
        <section ref={ref} id="projects" className="scroll-mt-28 mb-28">
            <SectionHeading>My projects</SectionHeading>
            <div>
                {projectsData.map((project) => (
                    <Project key={project.title} {...project} />
                ))}
            </div>
        </section>
    );
}
