"use server";

import { getPostContent, getSlugs } from "@/context/markdown-posts";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { components } from "@/components/blogs/md-components";

export default async function RemoteMdxPage({
    params,
}: {
    params: { slug: string };
}) {
    const slug = params.slug;

    const slugs = await getSlugs();

    if (!slugs.includes(slug)) {
        return notFound();
    }

    const post = await getPostContent(slug);

    return <ReactMarkdown children={post.content} components={components} />;
}
