import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import type { ProfileData } from "@/lib/sanity-client";
import { siteConfig } from "@/lib/config";

export default function Intro({
    profile,
    hasProjects,
}: {
    profile: ProfileData | null;
    hasProjects: boolean;
}) {
    return (
        <header id="home" className="career-intro">
            <p className="journal-eyebrow">THE WORK BEHIND THE WORDS</p>
            <h1 className="journal-title">Work &amp; experience.</h1>
            <p className="career-role">
                {profile?.headline || siteConfig.role}
            </p>
            <p className="journal-description">
                {profile?.introduction ||
                    "The systems I work on, the things I build, and what I learn along the way."}
            </p>
            <div className="career-actions">
                <Link
                    className="journal-link"
                    href={hasProjects ? "#projects" : "#experience"}
                >
                    {hasProjects ? "Explore the work" : "View experience"}
                    <ArrowDown size={16} aria-hidden />
                </Link>
                <Link className="journal-link" href="/resume">
                    Read my résumé
                    <ArrowUpRight size={16} aria-hidden />
                </Link>
            </div>
        </header>
    );
}
