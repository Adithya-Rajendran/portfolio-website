import { Suspense } from "react";
import dynamic from "next/dynamic";
import { getIntro, getAllSkillCategories, getAllCertifications } from "@/lib/sanity-client";
import HeroContent from "@/components/home/hero-content";

const BioSection = dynamic(() => import("@/components/home/bio-section"));
const SkillsPreview = dynamic(() => import("@/components/home/skills-preview"));
const CertificationsPreview = dynamic(
    () => import("@/components/home/certifications-preview"),
);
const NavCards = dynamic(() => import("@/components/home/nav-cards"));

/** Async wrapper — fetches intro data and renders the hero */
async function HeroWithData() {
    const intro = await getIntro();
    return <HeroContent subtitle={intro?.subtitle} />;
}

/** Async wrapper — fetches intro data and renders the bio */
async function BioWithData() {
    const intro = await getIntro();
    return <BioSection homeBio={intro?.homeBio as any} />;
}

/** Async wrapper — fetches skill categories */
async function SkillsWithData() {
    const skillCategories = await getAllSkillCategories();
    return <SkillsPreview skillCategories={skillCategories as any} />;
}

/** Async wrapper — fetches certifications */
async function CertsWithData() {
    const certifications = await getAllCertifications();
    return <CertificationsPreview certifications={certifications as any} />;
}

/** Skeleton matching BioSection dimensions to avoid CLS */
function BioSkeleton() {
    return (
        <div className="max-w-[52rem] w-full py-20 animate-pulse">
            <div className="space-y-4">
                <div className="h-5 w-full bg-white/[0.04] rounded" />
                <div className="h-5 w-5/6 bg-white/[0.04] rounded" />
                <div className="h-5 w-4/6 bg-white/[0.04] rounded" />
            </div>
        </div>
    );
}

/** Skeleton matching SkillsPreview dimensions */
function SkillsSkeleton() {
    return (
        <div className="w-full max-w-[64rem] pb-20 animate-pulse">
            <div className="h-7 w-48 bg-white/[0.04] rounded mx-auto mb-10" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-xl border border-white/8 bg-white/[0.03] p-6 h-48" />
                ))}
            </div>
        </div>
    );
}

/** Skeleton matching CertificationsPreview dimensions */
function CertsSkeleton() {
    return (
        <div className="w-full max-w-[64rem] pb-20 animate-pulse">
            <div className="h-7 w-40 bg-white/[0.04] rounded mx-auto mb-10" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-xl border border-white/8 bg-white/[0.03] p-6 h-40 flex flex-col items-center gap-4">
                        <div className="w-20 h-20 rounded-full bg-white/[0.04]" />
                        <div className="h-4 w-24 bg-white/[0.04] rounded" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function Home() {
    return (
        <main className="flex flex-col items-center px-4">
            {/* Preload hero image — only needed on home page */}
            <link rel="preload" href="/hero.webp" as="image" type="image/webp" fetchPriority="high" />

            {/* Hero streams in first — only depends on getIntro() */}
            <Suspense fallback={<HeroContent />}>
                <HeroWithData />
            </Suspense>

            <Suspense fallback={<BioSkeleton />}>
                <BioWithData />
            </Suspense>

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
