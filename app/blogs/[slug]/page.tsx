"use server";

import { getPostContent, getSlugs } from "@/context/markdown-posts";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";

export default async function RemoteMdxPage({
    params,
}: {
    params: { slug: string };
}) {
    const slug = params.slug;
    const slugs = await getSlugs();
    const post = await getPostContent(slug);

    if (!slugs.includes(slug)) {
        return notFound();
    }

    return <Markdown>{post.content}</Markdown>;
}
