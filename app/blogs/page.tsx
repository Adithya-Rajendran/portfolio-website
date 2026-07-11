import Link from "next/link";
import { PenLine } from "lucide-react";
import PostRow, { POST_ROW_LIST_CLASSES } from "@/components/blogs/post-row";
import ShowMorePosts from "@/components/blogs/show-more-posts";
import TagChips from "@/components/blogs/tag-chips";
import TerminalSection from "@/components/terminal/terminal-section";
import { PageShell } from "@/components/page-shell";
import { StatusCard } from "@/components/status-card";
import { Button } from "@/components/ui/button";
import { getAllPosts } from "@/lib/sanity-client";
import { collectTags } from "@/lib/tags";
import { getPostSlug } from "@/components/blogs/utils";
import NewsletterSignupForm from "@/components/newsletter/signup-form";
import { BlogJsonLd } from "@/components/json-ld";

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
                New deep-dives on cloud infrastructure, cybersecurity, and
                homelab experiments are on the way. Check back soon.
            </StatusCard>
        </section>
    );
}

async function BlogPosts() {
    const allPosts = await getAllPosts();

    if (allPosts.length === 0) {
        return <BlogsEmpty />;
    }

    const tags = collectTags(allPosts);

    return (
        <section aria-label="All posts">
            {tags.length > 0 && <TagChips tags={tags} className="mb-10" />}

            {/* One `ls` listing, newest first — featured posts keep their
                place in time and carry a mono `★ featured` chip instead of
                a separate card hero. ShowMorePosts caps the initial render
                and reveals more per click without refetching. */}
            <ShowMorePosts
                listClassName={POST_ROW_LIST_CLASSES}
                items={allPosts.map((post) => (
                    <PostRow key={getPostSlug(post) || post._id} post={post} />
                ))}
            />

            <div className="mt-8">
                <Link
                    href="/blogs/archive"
                    className="font-term text-sm text-slate-600 hover:text-accent dark:text-slate-400 transition-colors"
                >
                    [ ./archive --group-by year ]
                </Link>
            </div>
        </section>
    );
}

export default function Blogs() {
    return (
        <main id="main-content" tabIndex={-1} className="pb-24 sm:pb-32">
            <BlogJsonLd />

            <TerminalSection
                command="ls posts/ --sort date"
                path="~/blogs"
                className="w-full max-w-6xl mx-auto px-6 sm:px-8 pt-2 sm:pt-6"
                promptClassName="mb-8"
            >
                <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white text-balance">
                    The Blog
                </h1>
                <p className="mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-300 text-pretty">
                    Technical deep-dives into cloud infrastructure,
                    cybersecurity, and homelab experiments. All opinions are my
                    own.
                </p>
                <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
                    <a
                        href="/feed.xml"
                        className="font-term text-sm font-bold text-accent hover:opacity-80 transition-opacity"
                    >
                        [ rss ]
                    </a>
                    <Link
                        href="/blogs/archive"
                        className="font-term text-sm text-slate-600 hover:text-accent dark:text-slate-400 transition-colors"
                    >
                        [ ./archive ]
                    </Link>
                </div>
            </TerminalSection>

            <PageShell className="mt-14 sm:mt-16">
                <BlogPosts />

                <NewsletterSignupForm variant="inline" />
            </PageShell>
        </main>
    );
}
