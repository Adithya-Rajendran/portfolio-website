import { Suspense } from "react";
import dynamic from "next/dynamic";
import Intro from "@/components/portfolio/intro";
import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import type { PortableTextBlock } from "@portabletext/react";
import { siteConfig } from "@/lib/config";
import {
    getIntro,
    getAbout,
    getAllSkillCategories,
    getAllCertifications,
    getAllExperiences,
    getAllProjects,
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

async function IntroWithData() {
    const intro = await getIntro();
    return (
        <Intro
            body={(intro?.body ?? null) as PortableTextBlock[] | null}
            subtitle={intro?.subtitle ?? null}
        />
    );
}

async function AboutWithData() {
    const about = await getAbout();
    return <About body={(about?.body ?? null) as PortableTextBlock[] | null} />;
}

async function SkillsWithData() {
    const skillCategories = await getAllSkillCategories();
    return <Skills skillCategories={skillCategories} />;
}

async function CertsWithData() {
    const certifications = await getAllCertifications();
    return <Certifications certifications={certifications} />;
}

async function ExperienceWithData() {
    const experiences = await getAllExperiences();
    return <Experience experiences={experiences} />;
}

async function ProjectsWithData() {
    const projects = await getAllProjects();
    return <Projects projects={projects} />;
}

export default function Portfolio() {
    return (
        <main className="pb-24 sm:pb-32">
            <link
                rel="preload"
                href="/hero.webp"
                as="image"
                type="image/webp"
                fetchPriority="high"
            />

            <Suspense>
                <IntroWithData />
            </Suspense>

            <PageShell>
                <Suspense>
                    <AboutWithData />
                </Suspense>

                <Suspense>
                    <ExperienceWithData />
                </Suspense>

                <Suspense>
                    <ProjectsWithData />
                </Suspense>

                <Suspense>
                    <SkillsWithData />
                </Suspense>

                <Suspense>
                    <CertsWithData />
                </Suspense>

                <Suspense>
                    <Contact />
                </Suspense>
            </PageShell>
        </main>
    );
}
