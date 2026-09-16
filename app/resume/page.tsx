import type { Metadata } from "next";
import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import ResumeShareAction from "@/components/resume/resume-share-action";
import { siteConfig } from "@/lib/config";
import { resolveResumeAssetUrl } from "@/lib/resume";
import { getProfile } from "@/lib/sanity-client";
import "@/app/journal-career.css";

const canonicalUrl = `${siteConfig.url}/resume`;
export const metadata: Metadata = {
    title: "Résumé",
    description: `View ${siteConfig.author}'s current PDF résumé directly in your browser.`,
    alternates: { canonical: canonicalUrl },
    openGraph: {
        title: `Résumé | ${siteConfig.author}`,
        description: "Read the current PDF résumé directly in your browser.",
        url: canonicalUrl,
        type: "profile",
    },
};

export default async function ResumePage() {
    const profile = await getProfile();
    const viewUrl = resolveResumeAssetUrl(profile?.resumeUrl, "view");
    if (!viewUrl)
        return (
            <main
                id="main-content"
                tabIndex={-1}
                className="journal-page journal-container career-page"
            >
                <header className="career-intro">
                    <p className="journal-eyebrow">RÉSUMÉ</p>
                    <h1 className="journal-title">The record of my work.</h1>
                    <p className="journal-description">
                        The PDF is temporarily unavailable. You can still
                        explore my professional experience and get in touch.
                    </p>
                    <div className="career-actions">
                        <Link href="/portfolio" className="journal-button">
                            View work &amp; experience
                        </Link>
                        <Link
                            href="/portfolio#contact"
                            className="journal-link"
                        >
                            Say hello <span aria-hidden>↗</span>
                        </Link>
                    </div>
                </header>
            </main>
        );
    const embeddedUrl = new URL(viewUrl);
    embeddedUrl.hash = "view=FitH&toolbar=1&navpanes=0";
    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="journal-page journal-container career-page career-resume"
        >
            <header className="career-resume-heading">
                <div>
                    <p className="journal-eyebrow">RÉSUMÉ / PDF</p>
                    <h1 className="journal-title">The record of my work.</h1>
                    <p className="journal-description">
                        {profile?.name || siteConfig.author} · Experience,
                        education, and skills.
                    </p>
                </div>
                <div className="career-resume-actions">
                    <a
                        href="/resume/view"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="journal-button"
                    >
                        <ExternalLink size={16} aria-hidden />
                        Open PDF
                    </a>
                    <a
                        href="/resume/download"
                        className="career-action-secondary"
                        aria-label="Download résumé PDF"
                    >
                        <Download size={16} aria-hidden />
                        Download
                    </a>
                    <ResumeShareAction canonicalUrl={canonicalUrl} />
                </div>
            </header>
            <section
                aria-label="PDF résumé viewer"
                className="career-resume-viewer"
            >
                <iframe
                    src={embeddedUrl.toString()}
                    title={`${siteConfig.author} résumé PDF`}
                    loading="eager"
                    referrerPolicy="no-referrer"
                />
            </section>
            <p className="career-resume-note">
                Prefer a separate window?{" "}
                <a
                    href="/resume/view"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Open the PDF directly.
                </a>
            </p>
            <Link href="/portfolio" className="journal-link">
                Explore work &amp; experience <span aria-hidden>↗</span>
            </Link>
        </main>
    );
}
