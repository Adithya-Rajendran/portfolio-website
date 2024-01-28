"use server";

import { getPostContent, getSlugs } from "@/context/markdown-posts";
import ReactMarkdown from "react-markdown";
import { components } from "@/components/blogs/md-components";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Separator } from "@/components/ui/separator";

export default async function RemoteMdxPage({
    params,
}: {
    params: { slug: string };
}) {
    const { slug } = params;
    const post = await getPostContent(slug);
    if (!post) {
        return notFound();
    }
    const { content } = post;

    return (
        <>
            <section className="flex flex-col items-center px-4">
                <h1 className="text-6xl font-bold">{post.title}</h1>
                <p className="text-gray-500 p-2">{post.date}</p>
                <Separator className="dark:bg-gray-500" />
            </section>
            <ReactMarkdown components={components}>{content}</ReactMarkdown>
        </>
    );
}

export async function generateMetadata({
    params,
}: {
    params: { slug: string };
}): Promise<Metadata | undefined> {
    const { slug } = params;
    const post = await getPostContent(slug);
    if (!post) {
        return;
    }
    return {
        title: post.title,
        description: post.desc,
    };
}

export const generateStaticParams = async (): Promise<{ slug: string }[]> => {
    const slugs = await getSlugs();
    if (!slugs) {
        return [];
    }
    const paths = slugs.map((slug) => ({ slug: slug }));

    return paths;
};
