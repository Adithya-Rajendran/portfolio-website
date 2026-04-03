import { Suspense } from "react";
import Featured from "@/components/blogs/featured";
import Latest from "@/components/blogs/latest";
import { getAllPosts } from "@/lib/sanity-client";

/** Static hero — renders instantly with zero data dependencies */
function BlogHero() {
    return (
        <div className="container mx-auto px-6 mb-16">
            <div className="pt-8 pb-12 text-center">
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
                    <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-emerald-700 dark:from-emerald-400 dark:via-cyan-300 dark:to-emerald-400 bg-clip-text text-transparent">
                        Adithya&apos;s Blogs
                    </span>
                </h1>
                <p className="text-lg text-slate-500 dark:text-slate-400 max-w-[36rem] mx-auto leading-relaxed">
                    Technical deep-dives into cloud infrastructure,
                    cybersecurity, and homelab experiments.
                    <br />
                    All opinions are my own and do not reflect the views of my employer or anyone else.
                </p>
            </div>
        </div>
    );
}

/** Skeleton for the loading state of the featured section */
function FeaturedSkeleton() {
    return (
        <section className="container mx-auto px-6 mb-16 animate-pulse">
            <div className="h-4 w-24 bg-white/[0.06] rounded mb-6" />
            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 rounded-xl bg-white/[0.03] border border-white/8 aspect-[16/9]" />
                <div className="md:col-span-1 flex flex-col gap-6">
                    <div className="flex-1 rounded-xl bg-white/[0.03] border border-white/8 min-h-[12rem]" />
                    <div className="flex-1 rounded-xl bg-white/[0.03] border border-white/8 min-h-[12rem]" />
                </div>
            </div>
        </section>
    );
}

/** Skeleton for the loading state of the latest section */
function LatestSkeleton() {
    return (
        <section className="container mx-auto px-6 mb-16 animate-pulse">
            <div className="h-4 w-28 bg-white/[0.06] rounded mb-6" />
            <div className="flex gap-6">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex-shrink-0 w-80 rounded-xl bg-white/[0.03] border border-white/8 h-72" />
                ))}
            </div>
        </section>
    );
}

/**
 * Single async component — fetches all posts once and splits into
 * featured + latest, halving Sanity API calls (from 2 → 1).
 */
async function BlogPosts() {
    const allPosts = await getAllPosts();
    const featuredPosts = (allPosts || []).filter((p: any) => p.featured);
    return (
        <>
            <Featured posts={featuredPosts as any} showHero={false} />
            <Latest posts={allPosts as any} />
        </>
    );
}

export default function Blogs() {
    return (
        <main className="flex-1 pt-16 pb-12">
            {/* Hero renders instantly — no data deps */}
            <BlogHero />

            {/* Both sections stream together from a single Sanity call */}
            <Suspense fallback={<><FeaturedSkeleton /><LatestSkeleton /></>}>
                <BlogPosts />
            </Suspense>
        </main>
    );
}
