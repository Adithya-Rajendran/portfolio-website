import { PortableText } from "@portabletext/react";
import { portableTextComponents } from "@/components/blogs/portable-text-components";
import { BlogPostJsonLd } from "@/components/json-ld";
import { Separator } from "@/components/ui/separator";
import type { Post } from "@/sanity.types";

export default function BlogPostContent({ post }: { post: Post }) {
    return (
        <>
            <BlogPostJsonLd
                title={post.title || ""}
                description={post.description || ""}
                date={post.date || ""}
                slug={post.slug?.current || ""}
            />
            <article className="w-full">
                <section className="flex flex-col items-center px-4 py-8 max-w-4xl mx-auto">
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-center mb-4 text-balance">
                        {post.title || ""}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                        {post.date ? new Date(post.date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                        }) : ""}
                    </p>
                    <p className="text-slate-700 dark:text-slate-300 text-lg leading-relaxed max-w-3xl text-balance mb-8 font-medium">
                        {post.description || ""}
                    </p>
                    <Separator className="dark:bg-slate-700 bg-slate-200 w-full" />
                </section>
                {post.body && (
                    <div className="px-4 sm:px-8 py-8 max-w-4xl mx-auto prose prose-slate dark:prose-invert">
                        <PortableText
                            value={post.body}
                            components={portableTextComponents}
                        />
                    </div>
                )}
            </article>
        </>
    );
}
