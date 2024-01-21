import { getPostContent } from "@/context/markdown-posts";
import Markdown from "markdown-to-jsx";

export default async function BlogsPage(props: any) {
    const slug = props.params.slug;
    const content = await getPostContent(slug);
    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">this is a post: {slug}</h1>
            <article className="prose lg:prose-xl dark:prose-invert">
                <Markdown>{content}</Markdown>
            </article>
        </div>
    );
}
