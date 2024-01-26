import Link from "next/link";
import Image from "next/image";
import { getAllPosts } from "@/context/markdown-posts";

export default async function Featured() {
    const allPosts = await getAllPosts();
    const featured = ["ffuf", "nmap", "test"];
    const featuredPosts = allPosts.filter((post) =>
        featured.includes(post.slug)
    );

    return (
        <section className="container mx-auto px-6 mb-12">
            <h2 className="text-2xl font-bold mb-4">Featured Posts</h2>
            <div className="grid gap-6 md:grid-cols-3 sm:grid-cols-1">
                {featuredPosts.slice(0, 1).map((post) => (
                    <div
                        key={post.slug}
                        className="md:col-span-2 bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow"
                    >
                        <Image
                            alt={`Blog post thumbnail for ${post.title}`}
                            className="w-full h-auto object-cover"
                            height="400"
                            src={post.image}
                            style={{
                                aspectRatio: "700/400",
                                objectFit: "cover",
                            }}
                            width="700"
                        />
                        <div className="p-6">
                            <h3 className="text-2xl font-bold mb-2">
                                {post.title}
                            </h3>
                            <p className="text-gray-600 h-12 overflow-hidden dark:text-gray-400 mb-4">
                                {post.desc}
                            </p>
                            <Link
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                                href={`blogs/${post.slug}`}
                            >
                                Read More
                            </Link>
                        </div>
                    </div>
                ))}
                <div className="md:col-span-1">
                    {featuredPosts.slice(-2).map((post, index) => (
                        <div
                            key={post.slug}
                            className={`bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow ${
                                index === 0 ? "mb-6" : ""
                            }`}
                        >
                            <Image
                                alt={`Blog post thumbnail for ${post.title}`}
                                className="w-full h-auto object-cover"
                                height="300"
                                src={post.image}
                                style={{
                                    aspectRatio: "700/300",
                                    objectFit: "cover",
                                }}
                                width="700"
                            />
                            <div className="p-6">
                                <h3 className="text-2xl font-bold mb-2">
                                    {post.title}
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400 mb-4">
                                    {post.desc}
                                </p>
                                <Link
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                                    href={`blogs/${post.slug}`}
                                >
                                    Read More
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
