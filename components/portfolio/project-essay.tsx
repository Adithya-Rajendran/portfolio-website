import { PortableText, type PortableTextBlock } from "@portabletext/react";
import { createPortableTextComponents } from "@/components/blogs/portable-text-components";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { highlightCodeBlocks, type CodeBlock } from "@/lib/highlight-code";
import type { ProjectWithBody } from "@/lib/sanity-client";

function isCodeBlock(value: unknown): value is CodeBlock {
    if (!value || typeof value !== "object") return false;
    const block = value as { _type?: unknown; _key?: unknown };
    return block._type === "code" && typeof block._key === "string";
}

export default async function ProjectEssay({
    project,
}: {
    project: ProjectWithBody;
}) {
    const codeBlocks = project.body.filter(isCodeBlock);
    const highlighted = await highlightCodeBlocks(
        codeBlocks,
        `project-${project.slug}`,
        CACHE_TAGS.project,
    );

    return (
        <div className="journal-prose career-project-essay">
            <PortableText
                value={project.body as unknown as PortableTextBlock[]}
                components={createPortableTextComponents(highlighted, {})}
            />
        </div>
    );
}
