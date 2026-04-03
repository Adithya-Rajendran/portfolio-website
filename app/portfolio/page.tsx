import { Suspense } from "react";
import dynamic from "next/dynamic";
import Intro from "@/components/portfolio/intro";
import SectionDivider from "@/components/section-divider";
import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";

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

/** Async wrapper — each section fetches its own data independently */
async function IntroWithData() {
    const { getIntro } = await import("@/lib/sanity-client");
    const intro = await getIntro();
    return <Intro body={(intro?.body as any) ?? null} />;
}

async function AboutWithData() {
    const { getAbout } = await import("@/lib/sanity-client");
    const about = await getAbout();
    return <About body={(about?.body as any) ?? null} />;
}

async function SkillsWithData() {
    const { getAllSkillCategories } = await import("@/lib/sanity-client");
    const skillCategories = await getAllSkillCategories();
    return <Skills skillCategories={skillCategories} />;
}

async function CertsWithData() {
    const { getAllCertifications } = await import("@/lib/sanity-client");
    const certifications = await getAllCertifications();
    return <Certifications certifications={certifications as any} />;
}

async function ExperienceWithData() {
    const { getAllExperiences } = await import("@/lib/sanity-client");
    const experiences = await getAllExperiences();
    return <Experience experiences={experiences as any} />;
}

async function ProjectsWithData() {
    const { getAllProjects } = await import("@/lib/sanity-client");
    const projects = await getAllProjects();
    return <Projects projects={projects as any} />;
}

export default function Portfolio() {
    return (
        <>
            <main className="flex flex-col items-center px-4">
                <Suspense>
                    <IntroWithData />
                </Suspense>
                <SectionDivider />

                <Suspense>
                    <AboutWithData />
                </Suspense>

                <Suspense>
                    <SkillsWithData />
                </Suspense>

                <Suspense>
                    <CertsWithData />
                </Suspense>

                <Suspense>
                    <ExperienceWithData />
                </Suspense>

                <Suspense>
                    <ProjectsWithData />
                </Suspense>

                <Suspense>
                    <Contact />
                </Suspense>
            </main>
        </>
    );
}
