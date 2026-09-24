import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import type { ProfileData } from "@/lib/sanity-client";

export default function Intro({
    profile,
    hasProjects,
    hasWriting,
}: {
    profile: ProfileData | null;
    hasProjects: boolean;
    hasWriting: boolean;
}) {
    const evidenceLink = hasProjects
        ? { href: "#projects", label: "Explore the work" }
        : hasWriting
          ? { href: "#engineering-writing", label: "Read selected writing" }
          : profile?.timeline?.length
            ? { href: "#experience", label: "View experience" }
            : null;

    return (
        <header id="home" className="career-intro">
            <p className="journal-eyebrow">THE WORK BEHIND THE WORDS</p>
            <h1 className="journal-title">Work &amp; experience.</h1>
            {profile?.headline && (
                <p className="career-role">{profile.headline}</p>
            )}
            <p className="journal-description">
                {profile?.workSummary ||
                    profile?.introduction ||
                    "The systems I work on, the things I build, and what I learn along the way."}
            </p>
            <div className="career-actions">
                {evidenceLink && (
                    <Link className="journal-button" href={evidenceLink.href}>
                        {evidenceLink.label}
                        <ArrowDown size={16} aria-hidden />
                    </Link>
                )}
                <Link className="journal-link" href="/resume">
                    Résumé <ArrowUpRight size={16} aria-hidden />
                </Link>
                <Link className="journal-link" href="#contact">
                    Get in touch <ArrowUpRight size={16} aria-hidden />
                </Link>
            </div>
        </header>
    );
}
