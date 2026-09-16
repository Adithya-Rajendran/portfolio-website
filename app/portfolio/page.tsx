import type { Metadata } from "next";
import Link from "next/link";
import Intro from "@/components/portfolio/intro";
import Experience from "@/components/portfolio/experience";
import Projects from "@/components/portfolio/projects";
import Skills from "@/components/portfolio/skills";
import Certifications from "@/components/portfolio/certifications";
import Contact from "@/components/portfolio/contact";
import { getAllProjects, getProfile } from "@/lib/sanity-client";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
    title: "Work & experience",
    description: `Experience, projects, skills, and certifications from ${siteConfig.author}.`,
    alternates: { canonical: `${siteConfig.url}/portfolio` },
    openGraph: {
        title: `Work & experience | ${siteConfig.author}`,
        description:
            "The systems I work on, the things I build, and what I learn along the way.",
        url: `${siteConfig.url}/portfolio`,
    },
};

export default async function Portfolio() {
    const [profile, projects] = await Promise.all([
        getProfile(),
        getAllProjects(),
    ]);
    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="journal-page journal-container career-page"
        >
            <Intro profile={profile} hasProjects={projects.length > 0} />
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
            <Contact />
        </main>
    );
}
