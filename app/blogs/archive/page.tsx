import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Archive as ArchiveIcon } from "lucide-react";
import TerminalSection from "@/components/terminal/terminal-section";
import { PageShell } from "@/components/page-shell";
import { StatusCard } from "@/components/status-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import TagChips from "@/components/blogs/tag-chips";
import ArchiveList from "@/components/blogs/archive-list";
import {
    getPostSlug,
    readingTimeFromWordCount,
} from "@/components/blogs/utils";
import { collectTags } from "@/lib/tags";
import { getAllPosts } from "@/lib/sanity-client";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
    title: "Archive",
    description:
        "Every post, searchable by title, description, or tag and grouped by year.",
    alternates: {
        canonical: `${siteConfig.url}/blogs/archive`,
    },
    openGraph: {
        title: `Archive | ${siteConfig.author}`,
        description:
            "Every post, searchable by title, description, or tag and grouped by year.",
        url: `${siteConfig.url}/blogs/archive`,
    },
};

/** Loading silhouette: tag row + search input + compact row placeholders. */
function ArchiveSkeleton() {
    return (
        <div className="animate-pulse">
            <div className="flex flex-wrap gap-4 mb-8">
                {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-5 w-24" />
                ))}
            </div>
            <Skeleton className="h-12 w-full rounded-row mb-8" />
            <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                ))}
            </div>
        </div>
    );
}

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
                        <Link href="/blogs">Back to blog</Link>
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
    // edge case entirely rather than emitting /blogs/ links.
    const posts = allPosts
        .filter((post) => getPostSlug(post))
        .map((post) => ({
            slug: getPostSlug(post),
            title: post.title || "",
            description: post.description || "",
            date: post.date || "",
            tags: post.tags ?? [],
            readingMinutes: readingTimeFromWordCount(post.wordCount),
        }));

    return (
        <>
            <TagChips tags={collectTags(allPosts)} className="mb-8" />
            <ArchiveList posts={posts} />
        </>
    );
}

export default function ArchivePage() {
    return (
        <main id="main-content" tabIndex={-1} className="pb-24 sm:pb-32">
            <TerminalSection
                command="ls posts/ --group-by year"
                path="~/blogs"
                storageId="blogs-archive"
                className="w-full max-w-6xl mx-auto px-6 sm:px-8 pt-2 sm:pt-6"
                promptClassName="mb-8"
            >
                <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white text-balance">
                    Every post
                </h1>
                <p className="mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-300 text-pretty">
                    Search by title, description, or tag, or browse everything
                    I&apos;ve written, grouped by year.
                </p>
                <div className="mt-6">
                    <Link
                        href="/blogs"
                        aria-label="Back to all posts"
                        className="font-term text-sm text-slate-500 hover:text-accent dark:text-slate-400 transition-colors"
                    >
                        [ cd ~/blogs ]
                    </Link>
                </div>
            </TerminalSection>

            <PageShell className="mt-14 sm:mt-16">
                <div>
                    <Suspense fallback={<ArchiveSkeleton />}>
                        <ArchiveContent />
                    </Suspense>
                </div>
            </PageShell>
        </main>
    );
}
