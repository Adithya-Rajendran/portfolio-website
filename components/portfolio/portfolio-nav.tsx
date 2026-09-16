"use client";

import Link from "next/link";
import { portfolioLinks } from "@/lib/data";
import { useActiveSectionContext } from "@/context/active-section-context";

export default function PortfolioNav({
    showProjects,
    showExperience = true,
    showSkills = true,
    showCertifications = true,
}: {
    showProjects: boolean;
    showExperience?: boolean;
    showSkills?: boolean;
    showCertifications?: boolean;
}) {
    const { activeSection, setActiveSection, setTimeOfLastClick } =
        useActiveSectionContext();
    const links = portfolioLinks(showProjects).filter(
        (link) =>
            (link.name !== "Experience" || showExperience) &&
            (link.name !== "Skills" || showSkills) &&
            (link.name !== "Certifications" || showCertifications),
    );
    return (
        <nav
            className="career-nav journal-container"
            aria-label="Work sections"
        >
            <span className="career-nav-label">WORK INDEX</span>
            <ul>
                {links.map((link) => (
                    <li key={link.hash}>
                        <Link
                            href={link.hash}
                            aria-current={
                                activeSection === link.name
                                    ? "location"
                                    : undefined
                            }
                            onClick={() => {
                                setActiveSection(link.name);
                                setTimeOfLastClick(Date.now());
                            }}
                        >
                            {link.name}
                        </Link>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
