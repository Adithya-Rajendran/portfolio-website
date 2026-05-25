import { Suspense } from "react";
import { cacheLife, cacheTag } from "next/cache";
import type { PortableTextBlock } from "@portabletext/react";
import {
    getIntro,
    getAllSkillCategories,
    getAllCertifications,
    getAllProjects,
    getAllPosts,
    getAllExperiences,
} from "@/lib/sanity-client";
import HeroContent from "@/components/home/hero-content";
import ToolsMarquee from "@/components/home/tools-marquee";
import StatsBar, { computeYearsValue } from "@/components/home/stats-bar";
import BioSection from "@/components/home/bio-section";
import SkillsPreview from "@/components/home/skills-preview";
import CertificationsPreview from "@/components/home/certifications-preview";
import NavCards from "@/components/home/nav-cards";

async function HeroWithData() {
    const intro = await getIntro();
    return (
        <HeroContent
            subtitle={intro?.subtitle}
            description={intro?.heroDescription}
            available={intro?.available}
        />
    );
}

// Cache Components split: the counts are content-derived (cached at
// max, busted only by the Sanity webhook) while the years value is
// date-derived (cacheLife ~monthly so the rollover lands within ~30
// days of Jan 1 even without a content edit). The outer StatsWithData
// is intentionally uncached — it composes the two cache entries and
// streams from a Suspense boundary in <Home/>.
async function getCounts() {
    "use cache";
    cacheLife("max");
    cacheTag("portfolio");
    cacheTag("post-list");
    const [certifications, projects, posts] = await Promise.all([
        getAllCertifications(),
        getAllProjects(),
        getAllPosts(),
    ]);
    return {
        certCount: certifications.length,
        projectCount: projects.length,
        postCount: posts.length,
    };
}

async function getYearsValue() {
    "use cache";
    cacheLife({
        stale: 60 * 60 * 24, // 1 day SWR window
        revalidate: 60 * 60 * 24 * 30, // ~monthly background refresh
        expire: 60 * 60 * 24 * 365, // hard cap at 1 year
    });
    cacheTag("portfolio");
    const experiences = await getAllExperiences();
    return computeYearsValue(experiences);
}

async function StatsWithData() {
    const [counts, yearsValue] = await Promise.all([
        getCounts(),
        getYearsValue(),
    ]);
    return (
        <StatsBar
            yearsValue={yearsValue}
            certCount={counts.certCount}
            projectCount={counts.projectCount}
            postCount={counts.postCount}
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
