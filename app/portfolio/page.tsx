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
    getIntro,
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
    const [intro, about, experiences, projects, certifications, skillCategories] =
        await Promise.all([
            getIntro(),
            getAbout(),
            getAllExperiences(),
            getAllProjects(),
            getAllCertifications(),
            getAllSkillCategories(),
        ]);

    return (
        <>
            <main className="flex flex-col items-center px-4">
                <Intro body={intro?.body as any ?? null} />
                <SectionDivider />
                <About body={about?.body as any ?? null} />
                <Skills skillCategories={skillCategories} />
                <Certifications certifications={certifications as any} />
                <Experience experiences={experiences as any} />
                <Projects projects={projects as any} />
                <Contact />
            </main>
        </>
    );
}

