"use server";

import { getPostContent, getSlugs } from "@/context/markdown-posts";
import { notFound } from "next/navigation";
import { serialize } from "next-mdx-remote/serialize";
import { metadata } from "@/app/layout";
import RenderMD from "@/components/blogs/render-md";

export default async function RemoteMdxPage({
    params,
}: {
    params: { slug: string };
}) {
    const slug = params.slug;
    const [slugs, markdown] = await Promise.all([
        getSlugs(),
        getPostContent(slug), // return string "404 Not Found" if the file is not present
    ]);

    if (!slugs.includes(slug)) {
        return notFound();
    }
    const source = await serialize(markdown, { parseFrontmatter: true });

    metadata.title = String(source.frontmatter.title);
    metadata.description = String(source.frontmatter.description);

    return <RenderMD {...source} />;
}
