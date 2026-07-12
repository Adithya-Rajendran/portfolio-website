import Link from "next/link";
import type { Metadata } from "next";
import { Archive as ArchiveIcon } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { StatusCard } from "@/components/status-card";
import { Button } from "@/components/ui/button";
import TagChips from "@/components/blogs/tag-chips";
import ArchiveList from "@/components/blogs/archive-list";
import {
    getPostSlug,
    readingTimeFromWordCount,
} from "@/components/blogs/utils";
import { collectTags } from "@/lib/tags";
import { getAllPosts } from "@/lib/sanity-client";
import { siteConfig } from "@/lib/config";
import { PageIntro } from "@/components/page-intro";
import { TerminalRoute } from "@/components/terminal/terminal-route";

export const metadata: Metadata = {
    title: "Blog archive",
    description:
        "Every post, searchable by title, description, or tag and grouped by year.",
    alternates: {
        canonical: `${siteConfig.url}/blog/archive`,
    },
    openGraph: {
        title: `Blog archive | ${siteConfig.author}`,
        description:
            "Every post, searchable by title, description, or tag and grouped by year.",
        url: `${siteConfig.url}/blog/archive`,
    },
};

/**
 * Empty state — renders when no posts exist (pre-launch, dev without
 * Sanity, etc.). Mirrors BlogsEmpty on the index page.
 */
function ArchiveEmpty() {
    return (
        <div className="mx-auto max-w-2xl">
            <StatusCard
                icon={ArchiveIcon}
                heading="Nothing to search yet"
                actions={
                    <Button asChild variant="outline" size="sm">
                        <Link href="/blog">Back to blog</Link>
                    </Button>
                }
            >
                Once posts are published, they will show up here, searchable by
                title, description, or tag.
            </StatusCard>
        </div>
    );
}

async function ArchiveContent() {
    const allPosts = await getAllPosts();

    if (allPosts.length === 0) {
        return <ArchiveEmpty />;
    }

    // Rows key/link on the slug, so drop the (schema-invalid) slugless
    // edge case entirely rather than emitting /blog/ links.
    const posts = allPosts
        .filter((post) => getPostSlug(post))
        .map((post) => ({
            slug: getPostSlug(post),
            title: post.title || "",
            description: post.description || "",
            publishedAt: post.publishedAt || "",
            tags: post.tags ?? [],
            readingMinutes:
                post.wordCount > 0
                    ? readingTimeFromWordCount(post.wordCount)
                    : null,
        }));

    return (
        <>
            <TagChips tags={collectTags(allPosts)} className="mb-8" />
            <ArchiveList posts={posts} />
        </>
    );
}

export default async function ArchivePage() {
    return (
        <main id="main-content" tabIndex={-1} className="pb-24 sm:pb-32">
            <TerminalRoute path="~/blog" command="find . -type f">
                <PageIntro
                    size="compact"
                    title="The complete notebook"
                    description="Search by title, description, or tag, or browse everything I’ve written, grouped by year."
                    actions={
                        <Link
                            href="/blog"
                            aria-label="Back to the blog"
                            className="inline-flex min-h-11 items-center text-sm text-slate-600 transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c1))] dark:text-slate-400"
                        >
                            ← Back to the blog
                        </Link>
                    }
                />

                <PageShell className="mt-14 sm:mt-16">
                    <div>
                        <ArchiveContent />
                    </div>
                </PageShell>
            </TerminalRoute>
        </main>
    );
}
