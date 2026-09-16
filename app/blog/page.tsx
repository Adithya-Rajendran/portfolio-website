import Link from "next/link";
import type { Metadata } from "next";
import PostRow, { POST_ROW_LIST_CLASSES } from "@/components/blogs/post-row";
import TagChips from "@/components/blogs/tag-chips";
import NewsletterNotice from "@/components/newsletter/newsletter-notice";
import { getAllPosts } from "@/lib/sanity-client";
import { collectTags } from "@/lib/tags";
import { getPostSlug } from "@/components/blogs/utils";
import { BlogJsonLd } from "@/components/json-ld";
import { BLOG_DESCRIPTION, siteConfig } from "@/lib/config";

export const metadata: Metadata = {
    title: "Writing",
    description: BLOG_DESCRIPTION,
    alternates: { canonical: `${siteConfig.url}/blog` },
    openGraph: {
        title: `Writing | ${siteConfig.author}`,
        description: BLOG_DESCRIPTION,
        url: `${siteConfig.url}/blog`,
    },
};

export default async function Blogs() {
    const allPosts = await getAllPosts();
    const posts = allPosts.filter((post) => getPostSlug(post));
    const tags = collectTags(posts);

    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="journal-page journal-container journal-writing"
        >
            <BlogJsonLd />
            <header className="journal-writing-intro">
                <p className="journal-eyebrow">From the notebook</p>
                <h1 className="journal-title">Ideas, explored.</h1>
                <p className="journal-description">
                    Notes from building and learning. Infrastructure,
                    intelligent machines, and the questions that keep me
                    curious.
                </p>
            </header>
            <section aria-labelledby="all-posts-heading">
                <div className="journal-section-heading">
                    <h2 id="all-posts-heading">Latest writing</h2>
                    <Link href="/blog/archive" className="journal-link">
                        Search the archive <span aria-hidden>↗</span>
                    </Link>
                </div>
                {posts.length ? (
                    <div className={POST_ROW_LIST_CLASSES}>
                        {posts.map((post) => (
                            <PostRow key={getPostSlug(post)} post={post} />
                        ))}
                    </div>
                ) : (
                    <div className="journal-empty">
                        <h3>The next idea is taking shape.</h3>
                        <p>New notes will appear here as they are published.</p>
                    </div>
                )}
            </section>
            {tags.length > 0 && (
                <section
                    className="journal-topics"
                    aria-labelledby="topics-heading"
                >
                    <h2 id="topics-heading" className="journal-eyebrow">
                        Follow a thread
                    </h2>
                    <TagChips tags={tags} />
                </section>
            )}
            <NewsletterNotice />
        </main>
    );
}
