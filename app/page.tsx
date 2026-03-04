import { Suspense } from "react";
import dynamic from "next/dynamic";
import {
    getAllSkillCategories,
    getAllCertifications,
    getIntro,
} from "@/lib/sanity-client";
import HeroContent from "@/components/home/hero-content";
import BioSection from "@/components/home/bio-section";

const SkillsPreview = dynamic(() => import("@/components/home/skills-preview"));
const CertificationsPreview = dynamic(
    () => import("@/components/home/certifications-preview"),
);
const NavCards = dynamic(() => import("@/components/home/nav-cards"));

export default async function Home() {
    const [skillCategories, certifications, intro] = await Promise.all([
        getAllSkillCategories(),
        getAllCertifications(),
        getIntro(),
    ]);

    return (
        <main className="flex flex-col items-center px-4">
            <HeroContent subtitle={intro?.subtitle} />

            <BioSection homeBio={intro?.homeBio as any} />

            <Suspense>
                <SkillsPreview skillCategories={skillCategories as any} />
            </Suspense>

            <Suspense>
                <CertificationsPreview certifications={certifications as any} />
            </Suspense>

            <Suspense>
                <NavCards />
            </Suspense>
        </main>
    );
}
