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

/** Skeleton matching BioSection dimensions to avoid CLS */
function BioSkeleton() {
    return (
        <div className="w-full max-w-3xl mx-auto px-4 animate-pulse">
            <div className="glass rounded-2xl px-7 py-10 sm:px-10 sm:py-12 space-y-4">
                <div className="h-5 w-full bg-slate-200/60 dark:bg-white/[0.05] rounded" />
                <div className="h-5 w-5/6 bg-slate-200/60 dark:bg-white/[0.05] rounded" />
                <div className="h-5 w-4/6 bg-slate-200/60 dark:bg-white/[0.05] rounded" />
            </div>
        </div>
    );
}

function StatsSkeleton() {
    return (
        <div className="w-full max-w-6xl mx-auto px-2 sm:px-6 animate-pulse">
            <div className="glass rounded-2xl h-24" />
        </div>
    );
}

function SkillsSkeleton() {
    return (
        <div className="w-full max-w-6xl mx-auto px-2 sm:px-6 pb-20 animate-pulse">
            <div className="h-8 w-48 bg-slate-200/60 dark:bg-white/[0.05] rounded mx-auto mb-10" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="md:col-span-2 rounded-2xl glass h-52" />
                <div className="rounded-2xl glass h-52" />
                <div className="rounded-2xl glass h-52" />
            </div>
        </div>
    );
}

function CertsSkeleton() {
    return (
        <div className="w-full max-w-6xl mx-auto px-2 sm:px-6 pb-20 animate-pulse">
            <div className="h-8 w-40 bg-slate-200/60 dark:bg-white/[0.05] rounded mx-auto mb-10" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-2xl glass h-32" />
                ))}
            </div>
        </div>
    );
}

export default function Home() {
    return (
        <main className="flex flex-col items-stretch">
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

            <ToolsMarquee />

            <Suspense fallback={<BioSkeleton />}>
                <BioWithData />
            </Suspense>

            <div className="h-20" aria-hidden="true" />

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
