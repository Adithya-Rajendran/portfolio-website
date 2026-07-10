import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Archive as ArchiveIcon } from "lucide-react";
import UnifiedHero from "@/components/unified-hero";
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

/** Loading silhouette: tag row + a handful of compact row placeholders. */
function ArchiveSkeleton() {
    return (
        <div className="animate-pulse">
            <Skeleton className="h-6 w-64 rounded-pill mb-8" />
            <Skeleton className="h-12 w-full rounded-row mb-8" />
            <div className="flex flex-col gap-3">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="os-card-flat h-[4.5rem]" />
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
            <UnifiedHero
                eyebrow="Archive"
                title="Every post"
                description="Search by title, description, or tag, or browse everything I've written, grouped by year."
            />

            <PageShell>
                <div>
                    <Link
                        href="/blogs"
                        className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:opacity-80 transition-opacity"
                    >
                        <ArrowLeft className="w-4 h-4" aria-hidden />
                        Back to all posts
                    </Link>

                    <div className="mt-8">
                        <Suspense fallback={<ArchiveSkeleton />}>
                            <ArchiveContent />
                        </Suspense>
                    </div>
                </div>
            </PageShell>
        </main>
    );
}
