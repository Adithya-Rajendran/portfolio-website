"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { portfolioLinks } from "@/lib/data";
import { useActiveSectionContext } from "@/context/active-section-context";

export default function PortfolioNav({
    showProjects,
    showWriting,
    showExperience = true,
    showSkills = true,
    showCertifications = true,
}: {
    showProjects: boolean;
    showWriting: boolean;
    showExperience?: boolean;
    showSkills?: boolean;
    showCertifications?: boolean;
}) {
    const isWorkIndex = usePathname() === "/portfolio";
    const { activeSection, setActiveSection, setTimeOfLastClick } =
        useActiveSectionContext();
    const links = portfolioLinks(showProjects).filter(
        (link) =>
            link.name !== "Contact" &&
            (link.name !== "Writing" || showWriting) &&
            (link.name !== "Experience" || showExperience) &&
            (link.name !== "Skills" || showSkills) &&
            (link.name !== "Certifications" || showCertifications),
    );
    return (
        <div className="career-nav-wrap">
            <nav
                className={`career-nav journal-container${isWorkIndex ? "" : " career-nav-detail"}`}
                aria-label={isWorkIndex ? "Work sections" : "Work navigation"}
            >
                <span className="career-nav-label">
                    {isWorkIndex ? "WORK INDEX" : "CASE STUDY"}
                </span>
                {isWorkIndex ? (
                    <ul className="career-nav-sections">
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
                ) : (
                    <Link href="/portfolio" className="career-nav-back">
                        <span aria-hidden>←</span> Back to work
                    </Link>
                )}
                <div className="career-nav-actions">
                    <Link href="/resume">
                        Résumé <span aria-hidden>↗</span>
                    </Link>
                    <Link
                        href="/portfolio#contact"
                        aria-current={
                            isWorkIndex && activeSection === "Contact"
                                ? "location"
                                : undefined
                        }
                        onClick={() => {
                            setActiveSection("Contact");
                            setTimeOfLastClick(Date.now());
                        }}
                    >
                        Contact <span aria-hidden>↗</span>
                    </Link>
                </div>
            </nav>
        </div>
    );
}
