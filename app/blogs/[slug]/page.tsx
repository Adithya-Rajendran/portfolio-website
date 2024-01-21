import { getPostContent } from "@/context/markdown-posts";
import { MDXRemote } from "next-mdx-remote/rsc";

export default async function RemoteMdxPage(props: any) {
    const slug = props.params.slug;
    const markdown = await getPostContent(slug);
    return (
        <article className="prose prose-purple mx-auto lg:prose-xl dark:prose-invert">
            <MDXRemote source={markdown} />
        </article>
    );
}
