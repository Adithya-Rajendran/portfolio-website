import type { Metadata } from "next";
import Intro from "@/components/portfolio/intro";
import Experience from "@/components/portfolio/experience";
import Projects from "@/components/portfolio/projects";
import Skills from "@/components/portfolio/skills";
import Certifications from "@/components/portfolio/certifications";
import Contact from "@/components/portfolio/contact";
import EngineeringWriting from "@/components/portfolio/engineering-writing";
import PortfolioNav from "@/components/portfolio/portfolio-nav";
import { getAllPosts, getAllProjects, getProfile } from "@/lib/sanity-client";
import { getProfileLinks } from "@/lib/profile-content";
import { siteConfig } from "@/lib/config";

export async function generateMetadata(): Promise<Metadata> {
    const profile = await getProfile();
    const name = profile?.name || siteConfig.author;
    const description =
        profile?.workSummary ||
        profile?.introduction ||
        `Experience, projects, and education from ${name}.`;
    return {
        title: "Work & experience",
        description,
        alternates: { canonical: `${siteConfig.url}/portfolio` },
        openGraph: {
            title: `Work & experience | ${name}`,
            description,
            url: `${siteConfig.url}/portfolio`,
        },
        twitter: {
            card: "summary_large_image",
            title: `Work & experience | ${name}`,
            description,
        },
    };
}

export default async function Portfolio() {
    const [profile, projects, posts] = await Promise.all([
        getProfile(),
        getAllProjects(),
        getAllPosts(),
    ]);
    return (
        <div data-page="missions" data-legacy>
            <PortfolioNav
                variant="index"
                showProjects={projects.length > 0}
                showWriting={posts.some((post) => post.slug)}
                showExperience={Boolean(profile?.timeline?.length)}
                showSkills={Boolean(profile?.skillGroups?.length)}
                showCertifications={Boolean(profile?.credentials?.length)}
            />
            <div className="journal-page journal-container career-page">
                <Intro
                    profile={profile}
                    hasProjects={projects.length > 0}
                    hasWriting={posts.some((post) => post.slug)}
                />
                <Projects projects={projects} />
                <EngineeringWriting posts={posts} />
                <Experience entries={profile?.timeline ?? []} />
                <Skills groups={profile?.skillGroups ?? []} />
                <Certifications certifications={profile?.credentials ?? []} />
                <Contact links={getProfileLinks(profile)} />
            </div>
        </div>
    );
}
