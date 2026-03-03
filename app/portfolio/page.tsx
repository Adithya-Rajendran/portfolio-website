import { cacheLife } from "next/cache";
import Intro from "@/components/portfolio/intro";
import SectionDivider from "@/components/section-divider";
import About from "@/components/portfolio/about";
import Projects from "@/components/portfolio/projects";
import Skills from "@/components/portfolio/skills";
import Experience from "@/components/portfolio/experience";
import Contact from "@/components/portfolio/contact";
import Certifications from "@/components/portfolio/certifications";
import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";
import {
    getAbout,
    getAllExperiences,
    getAllProjects,
    getAllCertifications,
    getAllSkillCategories,
} from "@/lib/sanity-client";

export const metadata: Metadata = {
    title: "Portfolio",
    description:
        "Adithya Rajendran's portfolio - Cloud Field Engineer at Canonical with experience in OpenStack, Kubernetes, AWS, and cybersecurity. View projects, certifications, and work experience.",
    alternates: {
        canonical: `${siteConfig.url}/portfolio`,
    },
    openGraph: {
        title: `Portfolio | ${siteConfig.author}`,
        description: "Cloud Field Engineer at Canonical with experience in OpenStack, Kubernetes, AWS, and cybersecurity. View projects, certifications, and work experience.",
        url: `${siteConfig.url}/portfolio`,
    },
};

export default async function Portfolio() {
    "use cache";
    cacheLife("days");

    const [about, experiences, projects, certifications, skillCategories] =
        await Promise.all([
            getAbout(),
            getAllExperiences(),
            getAllProjects(),
            getAllCertifications(),
            getAllSkillCategories(),
        ]);

    return (
        <>
            <main className="flex flex-col items-center px-4">
                <Intro />
                <SectionDivider />
                <About body={about?.body ?? null} />
                <Skills skillCategories={skillCategories} />
                <Certifications certifications={certifications} />
                <Experience experiences={experiences} />
                <Projects projects={projects} />
                <Contact />
            </main>
        </>
    );
}
