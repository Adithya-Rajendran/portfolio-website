import Link from "next/link";
import Image from "next/image";
import { getPostContent } from "@/components/blogs/markdown-posts";
import { PostType } from "@/lib/types";

export default async function Featured() {
    const featured = ["homelab", "htb-poison-writeup", "active-directory-lab"];
    const allPostsPromises = featured.map((slug) => getPostContent(slug));
    const featuredPostsUnfiltered = await Promise.all(allPostsPromises);
    const featuredPosts = featuredPostsUnfiltered.filter(
        (post) => post !== undefined
    ) as PostType[];

    return (
        <section className="container mx-auto px-6 mb-12">
            <h2 className="text-2xl font-bold mb-4">Featured Posts</h2>
            <div className="grid gap-6 md:grid-cols-3 sm:grid-cols-1">
                {featuredPosts.slice(0, 1).map((post) => (
                    <div
                        key={post.slug}
                        className="md:col-span-2 bg-white dark:bg-white/[0.03] rounded-lg overflow-hidden shadow dark:border dark:border-white/8"
                    >
                        <Image
                            alt={`Blog post thumbnail for ${post.title}`}
                            className="w-full h-auto object-cover"
                            height="400"
                            width="700"
                            src={post.image}
                            loading="eager"
                            priority={true}
                            style={{
                                aspectRatio: "700/400",
                                objectFit: "cover",
                            }}
                        />
                        <div className="p-6">
                            <h3 className="text-2xl font-bold mb-2">
                                {post.title}
                            </h3>
                            <p className="text-slate-600 h-12 overflow-hidden dark:text-slate-400 mb-4">
                                {post.desc}
                            </p>
                            <Link
                                className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                                href={`blogs/${post.slug}`}
                                aria-label={`Read more about ${post.title}`}
                                title={`Read more about ${post.title}`}
                            >
                                Explore: {post.title}
                            </Link>
                        </div>
                    </div>
                ))}
                <div className="md:col-span-1">
                    {featuredPosts.slice(-2).map((post, index) => (
                        <div
                            key={post.slug}
                            className={`bg-white dark:bg-white/[0.03] rounded-lg overflow-hidden shadow dark:border dark:border-white/8 ${
                                index === 0 ? "mb-6" : ""
                            }`}
                        >
                            <Image
                                alt={`Blog post thumbnail for ${post.title}`}
                                className="w-full h-auto object-cover"
                                height="300"
                                width="700"
                                src={post.image}
                                loading="eager"
                                style={{
                                    aspectRatio: "700/300",
                                    objectFit: "cover",
                                }}
                            />
                            <div className="p-6">
                                <h3 className="text-2xl font-bold mb-2">
                                    {post.title}
                                </h3>
                                <p className="text-slate-600 h-12 overflow-hidden dark:text-slate-400 mb-4">
                                    {post.desc}
                                </p>
                                <Link
                                    className="text-emerald-700 hover:underline hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                                    href={`blogs/${post.slug}`}
                                    aria-label={`Read more about ${post.title}`}
                                    title={`Read more about ${post.title}`}
                                >
                                    Explore: {post.title}
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
