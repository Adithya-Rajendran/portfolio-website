import HeroArtwork, {
    preloadHeroArtwork,
} from "@/components/home/hero-artwork";
import Link from "next/link";
import { getAllPosts, getProfile } from "@/lib/sanity-client";
import { getProfileLink, selectFeaturedPost } from "@/lib/profile-content";
import { siteConfig } from "@/lib/config";
import { formatDate } from "@/components/blogs/utils";
import "./journal-home.css";

export default async function Home() {
    preloadHeroArtwork();
    const [profile, posts] = await Promise.all([getProfile(), getAllPosts()]);
    const featured = selectFeaturedPost(profile, posts);
    const recent = posts
        .filter((post) => post._id !== featured?._id)
        .slice(0, 4);
    const role = profile?.headline || siteConfig.role;
    const linkedin = getProfileLink(profile, "linkedin");
    const github = getProfileLink(profile, "github");
    return (
        <main id="main-content" tabIndex={-1} className="home-journal">
            <section className="fj-hero" aria-labelledby="home-title">
                <HeroArtwork />
                <div className="fj-shell fj-hero-inner">
                    <div className="fj-hero-copy">
                        {profile?.focusAreas?.length ? (
                            <p className="fj-eyebrow">
                                {profile.focusAreas.join(" · ")}
                            </p>
                        ) : null}
                        <h1 className="fj-title" id="home-title">
                            <span>The future is </span>
                            <span>
                                still <em>unwritten.</em>
                            </span>
                        </h1>
                        <p className="fj-intro">
                            <span className="fj-role">{role}</span>
                            {profile?.introduction || siteConfig.description}
                        </p>
                        <div className="fj-hero-actions">
                            <a className="fj-explore" href="#writing">
                                Read the notebook <span aria-hidden>↓</span>
                            </a>
                            {linkedin && (
                                <a
                                    className="fj-linkedin-top"
                                    href={linkedin.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Follow on LinkedIn{" "}
                                    <span aria-hidden>↗</span>
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </section>
            <div className="fj-shell">
                <section
                    className="fj-writing"
                    id="writing"
                    aria-labelledby="writing-title"
                >
                    <div className="fj-section-head">
                        <h2 id="writing-title">Writing</h2>
                        <div className="fj-section-links">
                            <Link href="/blog/archive">Archive ↗</Link>
                            <a href="/feed.xml">RSS ↗</a>
                        </div>
                    </div>
                    {featured ? (
                        <Link
                            className="fj-featured"
                            href={`/blog/${featured.slug}`}
                        >
                            <div>
                                <p className="fj-kicker">
                                    Start here
                                    {featured.tags?.[0]
                                        ? ` · ${featured.tags[0]}`
                                        : ""}
                                </p>
                                <h3>{featured.title}</h3>
                                <p className="fj-meta">
                                    <time dateTime={featured.publishedAt}>
                                        {formatDate(featured.publishedAt)}
                                    </time>
                                </p>
                            </div>
                            <div className="fj-featured-summary">
                                <p>{featured.description}</p>
                                <span className="fj-read-link">
                                    Read the field note{" "}
                                    <span aria-hidden>↗</span>
                                </span>
                            </div>
                        </Link>
                    ) : (
                        <p className="journal-description py-8">
                            The notebook is just getting started. Follow via RSS
                            for the next note.
                        </p>
                    )}
                    {recent.length > 0 && (
                        <p className="fj-recent-label">Recent notes</p>
                    )}
                    {recent.map((post) => (
                        <Link
                            key={post._id}
                            className="fj-note"
                            href={`/blog/${post.slug}`}
                        >
                            <time
                                className="fj-note-date"
                                dateTime={post.publishedAt}
                            >
                                {formatDate(post.publishedAt)}
                            </time>
                            <div className="fj-note-title">
                                <h3>{post.title}</h3>
                                {post.tags?.length ? (
                                    <div className="fj-note-category">
                                        {post.tags.slice(0, 3).join(" · ")}
                                    </div>
                                ) : null}
                            </div>
                            <p>{post.description}</p>
                            <span className="fj-note-arrow" aria-hidden>
                                ↗
                            </span>
                        </Link>
                    ))}
                </section>
                <section className="fj-work" aria-labelledby="work-title">
                    <div>
                        <p className="fj-kicker">The work behind the notes</p>
                        <h2 id="work-title">Engineering, in practice.</h2>
                    </div>
                    <div className="fj-work-copy">
                        <p>
                            {profile?.workSummary ||
                                profile?.introduction ||
                                siteConfig.description}
                        </p>
                        <div className="fj-work-links">
                            <Link href="/portfolio">View my work ↗</Link>
                            {github && (
                                <a
                                    href={github.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    GitHub ↗
                                </a>
                            )}
                            <Link href="/resume">Résumé ↗</Link>
                        </div>
                    </div>
                </section>
                <section className="fj-follow" aria-labelledby="follow-title">
                    <div>
                        <h2 id="follow-title">Follow the next note.</h2>
                        <p>
                            {linkedin
                                ? "Get new writing through RSS, or join the conversation on LinkedIn."
                                : "Get new writing through RSS."}
                        </p>
                    </div>
                    <div className="fj-follow-links">
                        {linkedin && (
                            <a
                                href={linkedin.url}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                LinkedIn ↗
                            </a>
                        )}
                        <a href="/feed.xml">Follow via RSS ↗</a>
                    </div>
                </section>
                <p className="journal-art-credit">
                    Imagined habitat · AI-generated artwork
                </p>
            </div>
        </main>
    );
}
