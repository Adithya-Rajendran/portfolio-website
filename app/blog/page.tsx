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
import TerminalSection from "@/components/terminal/terminal-section";

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
                <header className="mb-7 flex flex-col gap-4 border-b border-slate-400/25 pb-5 dark:border-white/10 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2
                            id="all-posts-heading"
                            className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl"
                        >
                            All posts
                        </h2>
                    </div>
                    <Link
                        href="/blog/archive"
                        className="inline-flex min-h-11 items-center text-sm text-slate-600 transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c1))] dark:text-slate-400"
                    >
                        Browse the full archive →
                    </Link>
                </header>

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
                    <p className="font-term text-[0.72rem] uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">
                        Index
                    </p>
                    <h2
                        id="topics-heading"
                        className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl"
                    >
                        Browse by topic
                    </h2>
                    <TagChips tags={tags} className="mt-6" />
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

            <TerminalSection
                as="div"
                path="~/blog"
                command="ls -t"
                promptVariant="compact"
                animatePrompt
                promptClassName="route-prompt mx-auto mb-5 w-full max-w-6xl px-6 pt-10 sm:px-8 sm:pt-16"
            >
                <header className="mx-auto w-full max-w-6xl px-6 pt-10 sm:px-8 sm:pt-16">
                    <h1 className="max-w-4xl font-display text-5xl font-semibold leading-[0.98] tracking-[-0.045em] text-balance text-slate-900 dark:text-white sm:text-7xl">
                        Blog
                    </h1>
                    <div className="mt-6 max-w-3xl border-l-2 border-accent pl-5 sm:pl-7">
                        <p className="text-base leading-relaxed text-pretty text-slate-600 dark:text-slate-300 sm:text-lg">
                            Technical notes, documentaries, things I&apos;m
                            learning, and the occasional detour. This is where I
                            write about whatever has my attention.
                        </p>
                    </div>
                </header>

                <PageShell className="mt-14 sm:mt-20 [&>*+*]:mt-16 sm:[&>*+*]:mt-24">
                    <BlogPosts allPosts={allPosts} />
                </PageShell>
            </TerminalSection>
        </main>
    );
}
