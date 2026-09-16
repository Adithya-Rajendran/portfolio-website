import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { ProfilePageJsonLd } from "@/components/json-ld";
import { getProfile } from "@/lib/sanity-client";
import { siteConfig } from "@/lib/config";
import { getProfileLink, getProfileLinks } from "@/lib/profile-content";
import "@/app/journal-career.css";

export async function generateMetadata(): Promise<Metadata> {
    const profile = await getProfile();
    const name = profile?.name || siteConfig.author;
    const description =
        profile?.introduction ||
        `About ${name}: the person behind the notebook.`;
    return {
        title: "About",
        description,
        alternates: { canonical: `${siteConfig.url}/about` },
        openGraph: {
            title: `About | ${name}`,
            description,
            url: `${siteConfig.url}/about`,
        },
    };
}

export default async function AboutPage() {
    const profile = await getProfile();
    const location = profile?.location;
    const links = getProfileLinks(profile);
    const linkedIn = getProfileLink(profile, "linkedin");
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
                {profile?.headline && (
                    <p className="career-role">{profile.headline}</p>
                )}
                {profile?.introduction && (
                    <p className="journal-description">
                        {profile.introduction}
                    </p>
                )}
                <div className="career-actions career-about-actions">
                    <Link href="/portfolio" className="journal-link">
                        Work &amp; experience{" "}
                        <ArrowUpRight size={16} aria-hidden />
                    </Link>
                    <Link href="/portfolio#contact" className="journal-link">
                        Get in touch <ArrowUpRight size={16} aria-hidden />
                    </Link>
                    {linkedIn && (
                        <a
                            href={linkedIn.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="journal-link"
                        >
                            LinkedIn <ArrowUpRight size={16} aria-hidden />
                        </a>
                    )}
                </div>
            </header>
            <div className="career-about-grid">
                <article
                    className="career-biography"
                    aria-labelledby="about-heading"
                >
                    <h2 id="about-heading">Curiosity, put into practice.</h2>
                    {profile?.bio && (
                        <div className="career-bio-text">{profile.bio}</div>
                    )}
                    <div className="career-actions">
                        <Link href="/blog" className="journal-link">
                            Explore my writing{" "}
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
                    {links.length > 0 && (
                        <h2 className="journal-eyebrow">ELSEWHERE</h2>
                    )}
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
