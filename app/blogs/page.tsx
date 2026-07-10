import { Suspense } from "react";
import Link from "next/link";
import { PenLine } from "lucide-react";
import Featured from "@/components/blogs/featured";
import Latest from "@/components/blogs/latest";
import UnifiedHero from "@/components/unified-hero";
import { PageShell } from "@/components/page-shell";
import { StatusCard } from "@/components/status-card";
import { Button } from "@/components/ui/button";
import { getAllPosts } from "@/lib/sanity-client";
import { Skeleton } from "@/components/ui/skeleton";
import NewsletterSignupForm from "@/components/newsletter/signup-form";

function FeaturedSkeleton() {
    return (
        <section className="animate-pulse">
            <Skeleton className="h-4 w-24 rounded mb-6" />
            <div className="grid gap-5 md:grid-cols-3">
                <div className="md:col-span-2 os-card aspect-[16/9]" />
                <div className="md:col-span-1 flex flex-col gap-5">
                    <div className="flex-1 os-card min-h-[12rem]" />
                    <div className="flex-1 os-card min-h-[12rem]" />
                </div>
            </div>
        </section>
    );
}

function LatestSkeleton() {
    return (
        <section className="animate-pulse">
            <Skeleton className="h-4 w-28 rounded mb-6" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="os-card h-72" />
                ))}
            </div>
        </section>
    );
}

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

    const featuredPosts = allPosts.filter((p) => p.featured);
    const restPosts = allPosts.filter((p) => !p.featured);

    return (
        <>
            <Featured posts={featuredPosts} />
            <Latest
                posts={restPosts}
                title={featuredPosts.length > 0 ? "More posts" : "All posts"}
            />
        </>
    );
}

export default function Blogs() {
    return (
        <main id="main-content" tabIndex={-1} className="pb-24 sm:pb-32">
            <UnifiedHero
                eyebrow="Blog"
                title="Notes from the field"
                description="Technical deep-dives into cloud infrastructure, cybersecurity, and homelab experiments. All opinions are my own."
            />

            <PageShell>
                <Suspense
                    fallback={
                        <>
                            <FeaturedSkeleton />
                            <LatestSkeleton />
                        </>
                    }
                >
                    <BlogPosts />
                </Suspense>

                <NewsletterSignupForm variant="inline" />
            </PageShell>
        </main>
    );
}
