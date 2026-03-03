"use cache";

import { cacheLife } from "next/cache";
import { getPostBySlug, getAllSlugs } from "@/lib/sanity-client";
import { PortableText } from "@portabletext/react";
import { portableTextComponents } from "@/components/blogs/portable-text-components";
import { BlogPostJsonLd } from "@/components/json-ld";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { siteConfig } from "@/lib/config";

export default async function BlogPostPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    cacheLife("hours");
    const { slug } = await params;
    const post = await getPostBySlug(slug);
    if (!post) {
        return notFound();
    }

    return (
        <>
            <BlogPostJsonLd
                title={post.title}
                description={post.description}
                date={post.date}
                slug={post.slug}
            />
            <section className="flex flex-col items-center px-4">
                <h1 className="text-6xl font-bold text-center">{post.title}</h1>
                <p className="text-gray-500 p-2">{post.date}</p>
                <p className="dark:text-cyan-300 text-cyan-900 text-justify">
                    {post.description}
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

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata | undefined> {
    const { slug } = await params;
    const post = await getPostBySlug(slug);
    if (!post) {
        return;
    }
    return {
        title: post.title,
        description: post.description,
        alternates: {
            canonical: `${siteConfig.url}/blogs/${slug}`,
        },
        openGraph: {
            title: post.title,
            description: post.description,
            type: "article",
            publishedTime: post.date,
            authors: [siteConfig.author],
            url: `${siteConfig.url}/blogs/${slug}`,
            images: [
                {
                    url: "/og-image.jpg",
                    width: 1200,
                    height: 630,
                    alt: post.title,
                },
            ],
        },
        robots: {
            index: true,
            follow: true,
        },
    };
}

export const dynamicParams = true;

export const generateStaticParams = async (): Promise<{ slug: string }[]> => {
    const slugs = await getAllSlugs();
    if (!slugs) {
        return [];
    }
    return slugs.map((slug) => ({ slug }));
};
