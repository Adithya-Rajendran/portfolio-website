import { getPostContent, getSlugs } from "@/context/markdown-posts";
import ReactMarkdown from "react-markdown";
import { components } from "@/components/blogs/md-components";
import { Metadata } from "next";
import { PostType } from "@/lib/types";

export const dynamicParams = false; // true | false,

export default async function RemoteMdxPage({ params }: any) {
    const { post } = await getPostData(params.slug);
    const { content } = post;

    return <ReactMarkdown components={components}>{content}</ReactMarkdown>;
}

export async function generateMetadata({ params }: any): Promise<Metadata> {
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
