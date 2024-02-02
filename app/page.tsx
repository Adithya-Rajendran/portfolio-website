import dynamic from "next/dynamic";

import Intro from "@/components/portfolio/intro";
import SectionDivider from "@/components/section-divider";
import About from "@/components/portfolio/about";
const Projects = dynamic(() => import("@/components/portfolio/projects"));
const Skills = dynamic(() => import("@/components/portfolio/skills"));
const Experience = dynamic(() => import("@/components/portfolio/experience"));
const Contact = dynamic(() => import("@/components/portfolio/contact"));
const VisitBlogs = dynamic(() => import("@/components/portfolio/visit-blog"));

export default function Home() {
    return (
        <main className="flex flex-col items-center px-4">
            <Intro />
            <SectionDivider />
            <About />
            <Projects />
            <Skills />
            <Experience />
            <Contact />
            <VisitBlogs />
        </main>
    );
}
