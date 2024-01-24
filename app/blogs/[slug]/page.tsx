"use server";

import { getPostContent, getSlugs } from "@/context/markdown-posts";
import ReactMarkdown from "react-markdown";
import { components } from "@/components/blogs/md-components";
import { Metadata } from "next";
import { PostType } from "@/lib/types";

export default async function RemoteMdxPage({ params }: any) {
    const { post } = await getPostData(params.slug);
    const { content } = post;

    return <ReactMarkdown components={components}>{content}</ReactMarkdown>;
}

export async function generateMetadata({ params }: any): Promise<Metadata> {
    const { metadata } = await getPostData(params.slug);
    return metadata;
}

export const getStaticPaths = async () => {
    const slugs = await getSlugs();
    const paths = slugs.map((slug) => ({ params: { slug: slug } }));

    return {
        paths,
        fallback: false,
    };
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
