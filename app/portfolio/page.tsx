import { Suspense } from "react";
import dynamic from "next/dynamic";
import Intro from "@/components/portfolio/intro";
import SectionDivider from "@/components/section-divider";
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

const About = dynamic(() => import("@/components/portfolio/about"));
const Skills = dynamic(() => import("@/components/portfolio/skills"));
const Certifications = dynamic(
    () => import("@/components/portfolio/certifications"),
);
const Experience = dynamic(() => import("@/components/portfolio/experience"));
const Projects = dynamic(() => import("@/components/portfolio/projects"));
const Contact = dynamic(() => import("@/components/portfolio/contact"));

export const metadata: Metadata = {
    title: "Portfolio",
    description:
        "Adithya Rajendran's portfolio - Cloud Field Engineer at Canonical with experience in OpenStack, Kubernetes, AWS, and cybersecurity. View projects, certifications, and work experience.",
    alternates: {
        canonical: `${siteConfig.url}/portfolio`,
    },
    openGraph: {
        title: `Portfolio | ${siteConfig.author}`,
        description:
            "Cloud Field Engineer at Canonical with experience in OpenStack, Kubernetes, AWS, and cybersecurity. View projects, certifications, and work experience.",
        url: `${siteConfig.url}/portfolio`,
    },
};

export default async function Portfolio() {
    const [
        intro,
        about,
        experiences,
        projects,
        certifications,
        skillCategories,
    ] = await Promise.all([
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
                <Intro body={(intro?.body as any) ?? null} />
                <SectionDivider />

                <Suspense>
                    <About body={(about?.body as any) ?? null} />
                </Suspense>

                <Suspense>
                    <Skills skillCategories={skillCategories} />
                </Suspense>

                <Suspense>
                    <Certifications certifications={certifications as any} />
                </Suspense>

                <Suspense>
                    <Experience experiences={experiences as any} />
                </Suspense>

                <Suspense>
                    <Projects projects={projects as any} />
                </Suspense>

                <Suspense>
                    <Contact />
                </Suspense>
            </main>
        </>
    );
}
