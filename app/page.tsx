import { Suspense } from "react";
import dynamic from "next/dynamic";
import type { PortableTextBlock } from "@portabletext/react";
import {
    getIntro,
    getAllSkillCategories,
    getAllCertifications,
    getAllProjects,
    getAllPosts,
} from "@/lib/sanity-client";
import HeroContent from "@/components/home/hero-content";

const StatsBar = dynamic(() => import("@/components/home/stats-bar"));
const ToolsMarquee = dynamic(() => import("@/components/home/tools-marquee"));
const BioSection = dynamic(() => import("@/components/home/bio-section"));
const SkillsPreview = dynamic(() => import("@/components/home/skills-preview"));
const CertificationsPreview = dynamic(
    () => import("@/components/home/certifications-preview"),
);
const NavCards = dynamic(() => import("@/components/home/nav-cards"));

async function HeroWithData() {
    const intro = await getIntro();
    return <HeroContent subtitle={intro?.subtitle} />;
}

async function StatsWithData() {
    const [certifications, projects, posts] = await Promise.all([
        getAllCertifications(),
        getAllProjects(),
        getAllPosts(),
    ]);
    return (
        <StatsBar
            certCount={certifications.length}
            projectCount={projects.length}
            postCount={posts.length}
        />
    );
}

async function BioWithData() {
    const intro = await getIntro();
    return (
        <BioSection
            homeBio={(intro?.homeBio ?? null) as PortableTextBlock[] | null}
        />
    );
}

async function SkillsWithData() {
    const skillCategories = await getAllSkillCategories();
    return <SkillsPreview skillCategories={skillCategories} />;
}

async function CertsWithData() {
    const certifications = await getAllCertifications();
    return <CertificationsPreview certifications={certifications} />;
}

function StatsSkeleton() {
    return (
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 animate-pulse">
            <div className="os-card rounded-3xl h-24" />
        </div>
    );
}

function BioSkeleton() {
    return (
        <div className="w-full max-w-3xl mx-auto px-4 animate-pulse">
            <div className="os-card rounded-3xl px-7 py-10 sm:px-10 sm:py-12 space-y-4">
                <div className="h-5 w-full bg-slate-200/60 dark:bg-white/[0.05] rounded" />
                <div className="h-5 w-5/6 bg-slate-200/60 dark:bg-white/[0.05] rounded" />
                <div className="h-5 w-4/6 bg-slate-200/60 dark:bg-white/[0.05] rounded" />
            </div>
        </div>
    );
}

function SkillsSkeleton() {
    return (
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pb-20 animate-pulse">
            <div className="h-8 w-48 bg-slate-200/60 dark:bg-white/[0.05] rounded mx-auto mb-10" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="rounded-3xl os-card h-52" />
                <div className="rounded-3xl os-card h-52" />
                <div className="rounded-3xl os-card h-52" />
            </div>
        </div>
    );
}

function CertsSkeleton() {
    return (
        <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 pb-20 animate-pulse">
            <div className="h-8 w-40 bg-slate-200/60 dark:bg-white/[0.05] rounded mx-auto mb-10" />
            <div className="rounded-3xl os-card h-64" />
        </div>
    );
}

export default function Home() {
    return (
        <main className="flex flex-col items-stretch gap-16 sm:gap-20 pb-16">
            <link
                rel="preload"
                href="/hero.webp"
                as="image"
                type="image/webp"
                fetchPriority="high"
            />

            <Suspense fallback={<HeroContent />}>
                <HeroWithData />
            </Suspense>

            <Suspense fallback={<StatsSkeleton />}>
                <StatsWithData />
            </Suspense>

            <Suspense fallback={<BioSkeleton />}>
                <BioWithData />
            </Suspense>

            <ToolsMarquee />

            <Suspense fallback={<SkillsSkeleton />}>
                <SkillsWithData />
            </Suspense>

            <Suspense fallback={<CertsSkeleton />}>
                <CertsWithData />
            </Suspense>

            <Suspense>
                <NavCards />
            </Suspense>
        </main>
    );
}
