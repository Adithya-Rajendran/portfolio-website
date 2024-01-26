"use server";

import { getPostContent, getSlugs } from "@/context/markdown-posts";
import ReactMarkdown from "react-markdown";
import { components } from "@/components/blogs/md-components";
import { Metadata } from "next";
import { PostType } from "@/lib/types";
import { notFound } from "next/navigation";
import { Separator } from "@/components/ui/separator";

async function validSlug(slug: string): Promise<boolean> {
    const allSlugs = await getSlugs();
    return allSlugs.includes(slug);
}

export default async function RemoteMdxPage({ params }: any) {
    const valid = await validSlug(params.slug);
    if (!valid) {
        return notFound();
    }
    const { post } = await getPostData(params.slug);
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

export async function generateMetadata({ params }: any): Promise<Metadata> {
    const valid = await validSlug(params.slug);
    if (!valid) {
        return {
            title: "Not Found",
        };
    }
    const { metadata } = await getPostData(params.slug);
    return metadata;
}

export const generateStaticParams = async () => {
    const slugs = await getSlugs();
    const paths = slugs.map((slug) => ({ slug: slug }));

    return paths;
};

async function getPostData(slug: string) {
    const post: PostType = await getPostContent(slug);

    const metadata: Metadata = {
        title: post.title,
        description: post.desc,
    };

    return {
        post,
        metadata,
    };
}
