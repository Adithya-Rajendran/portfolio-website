import { getPostContent, getSlugs } from "@/context/markdown-posts";
import { notFound } from "next/navigation";
import { serialize } from "next-mdx-remote/serialize";
import { MDXRemote } from "next-mdx-remote/rsc";

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

    return (
        <article className="prose prose-purple mx-auto lg:prose-xl dark:prose-invert">
            <MDXRemote source={markdown.content} />
        </article>
    );
}
