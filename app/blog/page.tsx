import Link from "next/link";
import type { Metadata } from "next";
import { PenLine } from "lucide-react";
import PostRow, { POST_ROW_LIST_CLASSES } from "@/components/blogs/post-row";
import TagChips from "@/components/blogs/tag-chips";
import NewsletterNotice from "@/components/newsletter/newsletter-notice";
import { PageShell } from "@/components/page-shell";
import { StatusCard } from "@/components/status-card";
import { Button } from "@/components/ui/button";
import { getAllPosts } from "@/lib/sanity-client";
import { collectTags } from "@/lib/tags";
import { getPostSlug } from "@/components/blogs/utils";
import { BlogJsonLd } from "@/components/json-ld";
import { BLOG_DESCRIPTION, siteConfig } from "@/lib/config";
import { PageIntro } from "@/components/page-intro";
import { SectionHeading } from "@/components/section-heading";
import { TerminalRoute } from "@/components/terminal/terminal-route";

export const metadata: Metadata = {
    title: "Blog",
    description: BLOG_DESCRIPTION,
    alternates: {
        canonical: `${siteConfig.url}/blog`,
    },
    openGraph: {
        title: `Blog | ${siteConfig.author}`,
        description: BLOG_DESCRIPTION,
        url: `${siteConfig.url}/blog`,
    },
};

/**
 * Empty state — renders when no posts exist (pre-launch, dev without
 * Sanity, etc.). Keeps the page from feeling broken.
 */
function BlogsEmpty() {
    return (
        <section className="mx-auto max-w-2xl">
            <StatusCard
                icon={PenLine}
                heading="Writing in progress"
                actions={
                    <Button asChild variant="outline" size="sm">
                        <Link href="/portfolio">Explore the portfolio</Link>
                    </Button>
                }
            >
                Nothing here yet. When I publish something, it will appear here
                in chronological order.
            </StatusCard>
        </section>
    );
}

function BlogPosts({
    allPosts,
}: {
    allPosts: Awaited<ReturnType<typeof getAllPosts>>;
}) {
    const posts = allPosts.filter((post) => getPostSlug(post));
    const tags = collectTags(allPosts);

    if (posts.length === 0) {
        return (
            <>
                <BlogsEmpty />
                <NewsletterNotice />
            </>
        );
    }

    return (
        <>
            <section aria-labelledby="all-posts-heading">
                <SectionHeading
                    headingId="all-posts-heading"
                    title="All posts"
                    action={
                        <Link
                            href="/blog/archive"
                            className="inline-flex min-h-11 items-center text-sm text-slate-600 transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c1))] dark:text-slate-400"
                        >
                            Browse the full archive →
                        </Link>
                    }
                />

                <div className={POST_ROW_LIST_CLASSES}>
                    {posts.map((post) => (
                        <PostRow
                            key={getPostSlug(post) || post._id}
                            post={post}
                        />
                    ))}
                </div>
            </section>

            {tags.length > 0 && (
                <section aria-labelledby="topics-heading">
                    <SectionHeading
                        headingId="topics-heading"
                        title="Browse by topic"
                    />
                    <TagChips tags={tags} />
                </section>
            )}

            <NewsletterNotice />
        </>
    );
}

export default async function Blogs() {
    const allPosts = await getAllPosts();

    return (
        <main id="main-content" tabIndex={-1} className="pb-24 sm:pb-32">
            <BlogJsonLd />

            <TerminalRoute path="~/blog" command="ls -t">
                <PageIntro
                    title="Blog"
                    description="Technical notes, documentaries, things I’m learning, and the occasional detour. This is where I write about whatever has my attention."
                />

                <PageShell className="mt-14 sm:mt-20 [&>*+*]:mt-16 sm:[&>*+*]:mt-24">
                    <BlogPosts allPosts={allPosts} />
                </PageShell>
            </TerminalRoute>
        </main>
    );
}
