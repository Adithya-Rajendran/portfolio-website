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

    if (!slugs.includes(slug)) {
        return notFound();
    }

    const post = await getPostContent(slug);

    return <Markdown>{post.content}</Markdown>;
}
