import Link from "next/link";
import PostRow, { POST_ROW_LIST_CLASSES } from "@/components/blogs/post-row";
import TagChips from "@/components/blogs/tag-chips";
import NewsletterNotice from "@/components/newsletter/newsletter-notice";
import { getAllPosts, getProfile } from "@/lib/sanity-client";
import { getWritingDescription } from "@/lib/profile-content";
import { collectTags } from "@/lib/tags";
import { getPostSlug } from "@/components/blogs/utils";
import { BlogJsonLd } from "@/components/json-ld";
export default async function Blogs() {
    const [allPosts, profile] = await Promise.all([
        getAllPosts(),
        getProfile(),
    ]);
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
                    {getWritingDescription(profile)}
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
