import { PortableText } from "@portabletext/react";
import { portableTextComponents } from "@/components/blogs/portable-text-components";
import { BlogPostJsonLd } from "@/components/json-ld";
import { Separator } from "@/components/ui/separator";
import type { Post } from "@/sanity.types";

export default function BlogPostContent({
    post,
}: {
    post: Post;
}) {
    return (
        <>
            <BlogPostJsonLd
                title={post.title || ""}
                description={post.description || ""}
                date={post.date || ""}
                slug={post.slug?.current || ""}
            />
            <section className="flex flex-col items-center px-4">
                <h1 className="text-6xl font-bold text-center">{post.title || ""}</h1>
                <p className="text-gray-500 p-2">{post.date || ""}</p>
                <p className="dark:text-cyan-300 text-cyan-900 text-justify">
                    {post.description || ""}
                </p>
                <Separator className="dark:bg-gray-500" />
            </section>
            {post.body && (
                <div className="prose-container px-4 sm:px-8 py-4 max-w-4xl mx-auto">
                    <PortableText
                        value={post.body}
                        components={portableTextComponents}
                    />
                </div>
            )}
        </>
    );
}
