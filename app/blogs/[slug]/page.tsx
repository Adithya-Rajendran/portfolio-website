"use server";

import { getPostContent, getSlugs } from "@/context/markdown-posts";
import ReactMarkdown from "react-markdown";
import { components } from "@/components/blogs/md-components";
import { Metadata } from "next";
import { PostType } from "@/lib/types";
import { notFound } from "next/navigation";

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

    return <ReactMarkdown components={components}>{content}</ReactMarkdown>;
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
