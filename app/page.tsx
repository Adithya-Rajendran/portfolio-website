import { Suspense } from "react";
import { cacheLife, cacheTag } from "next/cache";
import type { PortableTextBlock } from "@portabletext/react";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { Skeleton } from "@/components/ui/skeleton";
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
import RecentWriting from "@/components/home/recent-writing";
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
    cacheTag(CACHE_TAGS.portfolio);
    cacheTag(CACHE_TAGS.postList);
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
    cacheTag(CACHE_TAGS.portfolio);
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

async function WritingWithData() {
    const posts = await getAllPosts();
    return <RecentWriting posts={posts} />;
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
        <div className="w-full border-y border-slate-400/20 dark:border-white/[0.08]">
            <div className="max-w-6xl mx-auto px-6 sm:px-8 py-4">
                <Skeleton className="h-8 w-full max-w-2xl" />
            </div>
        </div>
    );
}

function RowsSkeleton({ rows = 3 }: { rows?: number }) {
    return (
        <div className="w-full max-w-6xl mx-auto px-6 sm:px-8 animate-pulse space-y-4">
            <Skeleton className="h-4 w-64" />
            {Array.from({ length: rows }, (_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
            ))}
        </div>
    );
}

function SkillsSkeleton() {
    return (
        <div className="w-full max-w-6xl mx-auto px-6 sm:px-8 animate-pulse">
            <Skeleton className="h-4 w-64 mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                <Skeleton className="h-52 w-full" />
                <Skeleton className="h-52 w-full" />
                <Skeleton className="h-52 w-full" />
            </div>
        </div>
    );
}

export default function Home() {
    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="flex flex-col items-stretch gap-16 sm:gap-20 pb-16"
        >
            <Suspense fallback={<HeroContent />}>
                <HeroWithData />
            </Suspense>

            <Suspense fallback={<StatsSkeleton />}>
                <StatsWithData />
            </Suspense>

            <Suspense fallback={<RowsSkeleton rows={4} />}>
                <WritingWithData />
            </Suspense>

            <Suspense fallback={<RowsSkeleton rows={2} />}>
                <BioWithData />
            </Suspense>

            <ToolsMarquee />

            <Suspense fallback={<SkillsSkeleton />}>
                <SkillsWithData />
            </Suspense>

            <Suspense fallback={<RowsSkeleton rows={3} />}>
                <CertsWithData />
            </Suspense>

            <NavCards />
        </main>
    );
}
