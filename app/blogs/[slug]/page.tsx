import { getPostBySlug, getAllSlugs } from "@/lib/sanity-client";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteConfig } from "@/lib/config";
import BlogPostContent from "@/components/blogs/blog-post-content";

export default async function BlogPostPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const post = await getPostBySlug(slug);
    if (!post) {
        return notFound();
    }

    return <BlogPostContent post={post} />;
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
