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

/** Hero silhouette shown while the intro content streams in. */
function HeroFallback() {
    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 pt-32 pb-16">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-10 w-72 max-w-full" />
            <Skeleton className="h-5 w-96 max-w-full" />
        </div>
    );
}

/** Section silhouette: header bar plus two card-shaped blocks. */
function SectionFallback() {
    return (
        <div>
            <Skeleton className="mb-12 h-8 w-56" />
            <div className="grid gap-5 md:grid-cols-2">
                <Skeleton className="h-40 rounded-3xl" />
                <Skeleton className="h-40 rounded-3xl" />
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

            <PageShell>
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
