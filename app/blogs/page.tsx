import { Suspense } from "react";
import Featured from "@/components/blogs/featured";
import Latest from "@/components/blogs/latest";
import PageHero from "@/components/page-hero";
import { PageShell } from "@/components/page-shell";
import { getAllPosts } from "@/lib/sanity-client";

function FeaturedSkeleton() {
    return (
        <section className="animate-pulse">
            <div className="h-4 w-24 bg-white/[0.06] rounded mb-6" />
            <div className="grid gap-5 md:grid-cols-3">
                <div className="md:col-span-2 rounded-2xl bg-white/[0.03] border border-white/8 aspect-[16/9]" />
                <div className="md:col-span-1 flex flex-col gap-5">
                    <div className="flex-1 rounded-2xl bg-white/[0.03] border border-white/8 min-h-[12rem]" />
                    <div className="flex-1 rounded-2xl bg-white/[0.03] border border-white/8 min-h-[12rem]" />
                </div>
            </div>
        </section>
    );
}

function LatestSkeleton() {
    return (
        <section className="animate-pulse">
            <div className="h-4 w-28 bg-white/[0.06] rounded mb-6" />
            <div className="flex gap-5">
                {[1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className="flex-shrink-0 w-80 rounded-2xl bg-white/[0.03] border border-white/8 h-72"
                    />
                ))}
            </div>
        </section>
    );
}

async function BlogPosts() {
    const allPosts = await getAllPosts();
    const featuredPosts = allPosts.filter((p) => p.featured);
    return (
        <>
            <Featured posts={featuredPosts} />
            <Latest posts={allPosts} />
        </>
    );
}

export default function Blogs() {
    return (
        <main className="pb-24 sm:pb-32">
            <PageHero
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
            </PageShell>
        </main>
    );
}
