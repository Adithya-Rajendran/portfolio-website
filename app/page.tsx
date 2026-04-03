import { Suspense } from "react";
import dynamic from "next/dynamic";
import { getIntro } from "@/lib/sanity-client";
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
    const { getIntro: fetchIntro } = await import("@/lib/sanity-client");
    const intro = await fetchIntro();
    return <BioSection homeBio={intro?.homeBio as any} />;
}

/** Async wrapper — fetches skill categories */
async function SkillsWithData() {
    const { getAllSkillCategories } = await import("@/lib/sanity-client");
    const skillCategories = await getAllSkillCategories();
    return <SkillsPreview skillCategories={skillCategories as any} />;
}

/** Async wrapper — fetches certifications */
async function CertsWithData() {
    const { getAllCertifications } = await import("@/lib/sanity-client");
    const certifications = await getAllCertifications();
    return <CertificationsPreview certifications={certifications as any} />;
}

export default function Home() {
    return (
        <main className="flex flex-col items-center px-4">
            {/* Hero streams in first — only depends on getIntro() */}
            <Suspense fallback={<HeroContent />}>
                <HeroWithData />
            </Suspense>

            <Suspense>
                <BioWithData />
            </Suspense>

            <Suspense>
                <SkillsWithData />
            </Suspense>

            <Suspense>
                <CertsWithData />
            </Suspense>

            <Suspense>
                <NavCards />
            </Suspense>
        </main>
    );
}
