"use client";

import { MDXRemote, MDXRemoteSerializeResult } from "next-mdx-remote";

export default function RenderMD(
    source: MDXRemoteSerializeResult<
        Record<string, unknown>,
        Record<string, unknown>
    >
) {
    return (
        <article className="prose prose-purple mx-auto lg:prose-xl md:prose-base sm:prose-sm xs:prose-sm dark:prose-invert">
            <MDXRemote {...source} />
        </article>
    );
}
