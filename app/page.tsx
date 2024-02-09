import Intro from "@/components/portfolio/intro";
import SectionDivider from "@/components/section-divider";
import About from "@/components/portfolio/about";
import Projects from "@/components/portfolio/projects";
import Skills from "@/components/portfolio/skills";
import Experience from "@/components/portfolio/experience";
import Contact from "@/components/portfolio/contact";
import VisitBlogs from "@/components/portfolio/visit-blog";
import Certifications from "@/components/portfolio/certifications";

export default function Home() {
    return (
        <main className="flex flex-col items-center px-4">
            <Intro />
            <SectionDivider />
            <About />
            <Skills />
            <Certifications />
            <Experience />
            <Projects />
            <Contact />
            <VisitBlogs />
        </main>
    );
}
