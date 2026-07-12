import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import Intro from "@/components/portfolio/intro";
import Experience from "@/components/portfolio/experience";
import Projects from "@/components/portfolio/projects";
import Skills from "@/components/portfolio/skills";
import Certifications from "@/components/portfolio/certifications";
import Contact from "@/components/portfolio/contact";
import { TerminalRoute } from "@/components/terminal/terminal-route";
import { getAllProjects, getProfile } from "@/lib/sanity-client";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
    title: "Portfolio",
    description: `Experience, projects, skills, and certifications from ${siteConfig.author}.`,
    alternates: { canonical: `${siteConfig.url}/portfolio` },
    openGraph: {
        title: `Portfolio | ${siteConfig.author}`,
        description:
            "A straightforward record of professional work and experience.",
        url: `${siteConfig.url}/portfolio`,
    },
};

export default async function Portfolio() {
    const [profile, projects] = await Promise.all([
        getProfile(),
        getAllProjects(),
    ]);

    const timeline = profile?.timeline ?? [];
    const skills = profile?.skillGroups ?? [];
    const credentials = profile?.credentials ?? [];

    return (
        <main id="main-content" tabIndex={-1} className="pb-20 sm:pb-28">
            <TerminalRoute path="~/portfolio" command="cat work.log">
                <Intro profile={profile} hasProjects={projects.length > 0} />

                <PageShell className="mt-16 sm:mt-20">
                    <Experience entries={timeline} />
                    <Projects projects={projects} />
                    <Skills groups={skills} />
                    <Certifications certifications={credentials} />
                    <Contact />
                </PageShell>
            </TerminalRoute>
        </main>
    );
}
