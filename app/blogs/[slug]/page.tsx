
import { getPostContent, getSlugs } from "@/components/blogs/markdown-posts";
import ReactMarkdown from "react-markdown";
import { components } from "@/components/blogs/md-components";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Separator } from "@/components/ui/separator";

export default async function RemoteMdxPage({
    params,
}: {
    params: { slug: string };
}) {
    const { slug } = params;
    const post = await getPostContent(slug);
    if (!post) {
        return notFound();
    }

    return (
        <>
            <section className="flex flex-col items-center px-4">
                <h1 className="text-6xl font-bold text-center">{post.title}</h1>
                <p className="text-gray-500 p-2">{post.date}</p>
                <p className="dark:text-cyan-300 text-cyan-900 text-justify">
                    {post.desc}
                </p>
                <Separator className="dark:bg-gray-500" />
            </section>
            <ReactMarkdown components={components}>
                {post.content}
            </ReactMarkdown>
        </>
    );
}

export async function generateMetadata({
    params,
}: {
    params: { slug: string };
}): Promise<Metadata | undefined> {
    const { slug } = params;
    const post = await getPostContent(slug);
    if (!post) {
        return;
    }
    return {
        title: post.title,
        description: post.desc,
        robots: {
            index: true,
            follow: false,
        },
    };
}

export const generateStaticParams = async (): Promise<{ slug: string }[]> => {
    const slugs = await getSlugs();
    if (!slugs) {
        return [];
    }
    const paths = slugs.map((slug) => ({ slug: slug }));

    return paths;
};
