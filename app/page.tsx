import About from "@/components/portfolio/about";
import Contact from "@/components/portfolio/contact";
import Experience from "@/components/portfolio/experience";
import Intro from "@/components/portfolio/intro";
import Projects from "@/components/portfolio/projects";
import SectionDivider from "@/components/section-divider";
import Skills from "@/components/portfolio/skills";

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
        </main>
    );
}
