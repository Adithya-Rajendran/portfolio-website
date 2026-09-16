import type { Metadata } from "next";
import Link from "next/link";
import Intro from "@/components/portfolio/intro";
import Experience from "@/components/portfolio/experience";
import Projects from "@/components/portfolio/projects";
import Skills from "@/components/portfolio/skills";
import Certifications from "@/components/portfolio/certifications";
import Contact from "@/components/portfolio/contact";
import EngineeringWriting from "@/components/portfolio/engineering-writing";
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
    };
}

export default async function Portfolio() {
    const [profile, projects, posts] = await Promise.all([
        getProfile(),
        getAllProjects(),
        getAllPosts(),
    ]);
    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="journal-page journal-container career-page"
        >
            <Intro profile={profile} hasProjects={projects.length > 0} />
            {!projects.length && <EngineeringWriting posts={posts} />}
            <Experience entries={profile?.timeline ?? []} />
            <Projects projects={projects} />
            <Skills groups={profile?.skillGroups ?? []} />
            <Certifications certifications={profile?.credentials ?? []} />
            <aside className="career-reading">
                <div>
                    <p className="journal-eyebrow">THINKING IN PUBLIC</p>
                    <h2>The notes behind the work.</h2>
                    <p>
                        Experiments, engineering decisions, and lessons from
                        getting things running.
                    </p>
                </div>
                <Link className="journal-link" href="/blog">
                    Read the notebook <span aria-hidden>↗</span>
                </Link>
            </aside>
            <Contact links={getProfileLinks(profile)} />
        </main>
    );
}
