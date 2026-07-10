import { Suspense } from "react";
import dynamic from "next/dynamic";
import Intro from "@/components/portfolio/intro";
import { PageShell } from "@/components/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import type { Metadata } from "next";
import type { PortableTextBlock } from "@portabletext/react";
import { siteConfig } from "@/lib/config";
import {
    getIntro,
    getAllSkillCategories,
    getAllCertifications,
    getAllExperiences,
    getAllProjects,
} from "@/lib/sanity-client";

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

/** Hero silhouette: prompt line, heading block, portrait column. */
function HeroFallback() {
    return (
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-8 pt-2 sm:pt-6">
            <Skeleton className="mb-8 h-5 w-72 max-w-full" />
            <div className="grid items-center gap-10 lg:gap-16 lg:grid-cols-[minmax(0,1fr)_15rem]">
                <div>
                    <Skeleton className="h-11 w-64 max-w-full" />
                    <Skeleton className="mt-4 h-5 w-96 max-w-full" />
                    <Skeleton className="mt-5 h-20 w-full max-w-xl" />
                </div>
                <Skeleton className="mx-auto hidden aspect-square w-full max-w-[15rem] lg:block" />
            </div>
        </div>
    );
}

/** Section silhouette: prompt line plus log-style rows. */
function SectionFallback() {
    return (
        <div>
            <Skeleton className="mb-10 h-5 w-64" />
            <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
            </div>
        </div>
    );
}

async function IntroWithData() {
    const intro = await getIntro();
    return (
        <Intro
            body={(intro?.body ?? null) as PortableTextBlock[] | null}
            subtitle={intro?.subtitle ?? null}
        />
    );
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
        <main id="main-content" tabIndex={-1} className="pb-24 sm:pb-32">
            <Suspense fallback={<HeroFallback />}>
                <IntroWithData />
            </Suspense>

            <PageShell className="mt-16 sm:mt-24">
                {/* The About prose moved to the standalone /about page —
                    the portfolio is the work/credentials deep view. */}
                <Suspense fallback={<SectionFallback />}>
                    <ExperienceWithData />
                </Suspense>

                <Suspense fallback={<SectionFallback />}>
                    <ProjectsWithData />
                </Suspense>

                <Suspense fallback={<SectionFallback />}>
                    <SkillsWithData />
                </Suspense>

                <Suspense fallback={<SectionFallback />}>
                    <CertsWithData />
                </Suspense>

                <Suspense fallback={<SectionFallback />}>
                    <Contact />
                </Suspense>
            </PageShell>
        </main>
    );
}
