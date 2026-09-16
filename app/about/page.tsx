import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { ProfilePageJsonLd } from "@/components/json-ld";
import { getProfile } from "@/lib/sanity-client";
import { siteConfig, socialProfiles } from "@/lib/config";
import "@/app/journal-career.css";

export const metadata: Metadata = {
    title: "About",
    description: `About ${siteConfig.author}: the engineer behind the notebook.`,
    alternates: { canonical: `${siteConfig.url}/about` },
    openGraph: {
        title: `About | ${siteConfig.author}`,
        description: `The engineer behind the notebook.`,
        url: `${siteConfig.url}/about`,
    },
};

function fallbackLinks() {
    return socialProfiles.map((url) => {
        const host = new URL(url).hostname.replace(/^(www|app)\./, "");
        const label = host.includes("linkedin")
            ? "LinkedIn"
            : host.includes("github")
              ? "GitHub"
              : host.includes("credly")
                ? "Credly"
                : host.includes("hackthebox")
                  ? "Hack The Box"
                  : host.includes("tryhackme")
                    ? "TryHackMe"
                    : host;
        return { _key: url, label, url };
    });
}

export default async function AboutPage() {
    const profile = await getProfile();
    const location = profile?.location || siteConfig.location;
    const links = profile?.socialLinks?.length
        ? profile.socialLinks
        : fallbackLinks();
    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="journal-page journal-container career-page"
        >
            <ProfilePageJsonLd />
            <header className="career-intro">
                <p className="journal-eyebrow">
                    THE PERSON BEHIND THE NOTEBOOK
                </p>
                <h1 className="journal-title">
                    {profile?.name || siteConfig.author}
                    <span className="career-accent">.</span>
                </h1>
                <p className="career-role">
                    {profile?.headline || siteConfig.role}
                </p>
                {profile?.introduction && (
                    <p className="journal-description">
                        {profile.introduction}
                    </p>
                )}
            </header>
            <div className="career-about-grid">
                <article
                    className="career-biography"
                    aria-labelledby="about-heading"
                >
                    <h2 id="about-heading">Curiosity, put into practice.</h2>
                    <div className="career-bio-text">
                        {profile?.bio ||
                            "I’m interested in how intelligent machines see, act, and help us build what comes next. This notebook is where I share what I’m learning, alongside the systems and engineering work that get me there."}
                    </div>
                    <div className="career-actions">
                        <Link href="/blog" className="journal-link">
                            Explore my writing{" "}
                            <ArrowUpRight size={16} aria-hidden />
                        </Link>
                        <Link href="/portfolio" className="journal-link">
                            Work &amp; experience{" "}
                            <ArrowUpRight size={16} aria-hidden />
                        </Link>
                    </div>
                    {profile?.currentCuriosities?.length ? (
                        <section
                            className="career-curiosities"
                            aria-labelledby="curiosities-heading"
                        >
                            <p className="journal-eyebrow">
                                FOLLOWING MY CURIOSITY
                            </p>
                            <h2 id="curiosities-heading">
                                Questions worth pursuing.
                            </h2>
                            <ul>
                                {profile.currentCuriosities.map((item) => (
                                    <li key={item._key}>
                                        <h3>
                                            {item.url ? (
                                                <a
                                                    href={item.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    {item.title}{" "}
                                                    <ArrowUpRight
                                                        size={15}
                                                        aria-hidden
                                                    />
                                                </a>
                                            ) : (
                                                item.title
                                            )}
                                        </h3>
                                        {item.note && <p>{item.note}</p>}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ) : null}
                </article>
                <aside
                    className="career-about-aside"
                    aria-label="Profile links"
                >
                    {location && (
                        <p className="career-location">
                            <MapPin size={16} aria-hidden />
                            {location}
                        </p>
                    )}
                    <Link className="career-channel" href="/resume">
                        Read my résumé <ArrowUpRight size={17} aria-hidden />
                    </Link>
                    <h2 className="journal-eyebrow">ELSEWHERE</h2>
                    <ul>
                        {links.map((link) => (
                            <li key={link._key}>
                                <a
                                    className="career-channel"
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {link.label}
                                    <ArrowUpRight size={17} aria-hidden />
                                </a>
                            </li>
                        ))}
                    </ul>
                    <Link className="journal-link" href="/portfolio#contact">
                        Say hello <ArrowUpRight size={16} aria-hidden />
                    </Link>
                </aside>
            </div>
        </main>
    );
}
