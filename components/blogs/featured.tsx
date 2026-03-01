import Link from "next/link";
import Image from "next/image";
import { getFeaturedPosts } from "@/lib/sanity-client";
import { urlForImage } from "@/lib/sanity-image";

export default async function Featured() {
    const featuredPosts = await getFeaturedPosts();

    if (!featuredPosts || featuredPosts.length === 0) {
        return null;
    }

    return (
        <section className="container mx-auto px-6 mb-12">
            <h2 className="text-2xl font-bold mb-4">Featured Posts</h2>
            <div className="grid gap-6 md:grid-cols-3 sm:grid-cols-1">
                {featuredPosts.slice(0, 1).map((post) => {
                    const imageUrl = post.image
                        ? urlForImage(post.image)
                              .width(700)
                              .height(400)
                              .fit("crop")
                              .auto("format")
                              .url()
                        : null;
                    return (
                        <div
                            key={post.slug}
                            className="md:col-span-2 bg-white border border-emerald-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md hover:shadow-emerald-100 transition-shadow dark:bg-white/[0.03] dark:border-white/8 dark:hover:shadow-none"
                        >
                            {imageUrl && (
                                <Image
                                    alt={
                                        post.image?.alt ||
                                        `Blog post thumbnail for ${post.title}`
                                    }
                                    className="w-full h-auto object-cover"
                                    height={400}
                                    width={700}
                                    src={imageUrl}
                                    loading="eager"
                                    priority={true}
                                    style={{
                                        aspectRatio: "700/400",
                                        objectFit: "cover",
                                    }}
                                />
                            )}
                            <div className="p-6">
                                <h3 className="text-2xl font-bold mb-2">
                                    {post.title}
                                </h3>
                                <p className="text-slate-600 h-12 overflow-hidden dark:text-slate-400 mb-4">
                                    {post.description}
                                </p>
                                <Link
                                    className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                                    href={`blogs/${post.slug}`}
                                    aria-label={`Read more about ${post.title}`}
                                    title={`Read more about ${post.title}`}
                                >
                                    {"Explore: "}{post.title}
                                </Link>
                            </div>
                        </div>
                    );
                })}
                <div className="md:col-span-1">
                    {featuredPosts.slice(1, 3).map((post, index) => {
                        const imageUrl = post.image
                            ? urlForImage(post.image)
                                  .width(700)
                                  .height(300)
                                  .fit("crop")
                                  .auto("format")
                                  .url()
                            : null;
                        return (
                            <div
                                key={post.slug}
                                className={`bg-white border border-emerald-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md hover:shadow-emerald-100 transition-shadow dark:bg-white/[0.03] dark:border-white/8 dark:hover:shadow-none ${
                                    index === 0 ? "mb-6" : ""
                                }`}
                            >
                                {imageUrl && (
                                    <Image
                                        alt={
                                            post.image?.alt ||
                                            `Blog post thumbnail for ${post.title}`
                                        }
                                        className="w-full h-auto object-cover"
                                        height={300}
                                        width={700}
                                        src={imageUrl}
                                        loading="eager"
                                        style={{
                                            aspectRatio: "700/300",
                                            objectFit: "cover",
                                        }}
                                    />
                                )}
                                <div className="p-6">
                                    <h3 className="text-2xl font-bold mb-2">
                                        {post.title}
                                    </h3>
                                    <p className="text-slate-600 h-12 overflow-hidden dark:text-slate-400 mb-4">
                                        {post.description}
                                    </p>
                                    <Link
                                        className="text-emerald-700 hover:underline hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                                        href={`blogs/${post.slug}`}
                                        aria-label={`Read more about ${post.title}`}
                                        title={`Read more about ${post.title}`}
                                    >
                                        {"Explore: "}{post.title}
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
