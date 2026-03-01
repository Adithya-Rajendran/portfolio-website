import Intro from "@/components/portfolio/intro";
import SectionDivider from "@/components/section-divider";
import About from "@/components/portfolio/about";
import Projects from "@/components/portfolio/projects";
import Skills from "@/components/portfolio/skills";
import Experience from "@/components/portfolio/experience";
import Contact from "@/components/portfolio/contact";
import Certifications from "@/components/portfolio/certifications";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Portfolio",
    description:
        "Adithya Rajendran's portfolio - Cloud Field Engineer at Canonical with experience in OpenStack, Kubernetes, AWS, and cybersecurity. View projects, certifications, and work experience.",
    alternates: {
        canonical: "https://adithya-rajendran.com/portfolio",
    },
};

export default function Portfolio() {
    return (
        <>
            <main className="flex flex-col items-center px-4">
                <Intro />
                <SectionDivider />
                <About />
                <Skills />
                <Certifications />
                <Experience />
                <Projects />
                <Contact />
            </main>
        </>
    );
}
