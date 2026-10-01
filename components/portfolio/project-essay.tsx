import { PortableText, type PortableTextBlock } from "@portabletext/react";
import { createPortableTextComponents } from "@/components/blogs/portable-text-components";
import Footnotes from "@/components/prose/footnotes";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { extractHeadings, headingIdsByKey } from "@/lib/headings";
import { highlightCodeBlocks, type CodeBlock } from "@/lib/highlight-code";
import { indexProse } from "@/lib/prose";
import type { ProjectWithBody } from "@/lib/sanity-client";

function isCodeBlock(value: unknown): value is CodeBlock {
    if (!value || typeof value !== "object") return false;
    const block = value as { _type?: unknown; _key?: unknown };
    return block._type === "code" && typeof block._key === "string";
}

/**
 * A mission's write-up, drawn by the same long-read renderers as a post
 * (numbered listings, plates, callouts, footnotes with their notes). Its
 * headings carry the ids a model callout can link to.
 */
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
    const index = indexProse(project.body);

    return (
        <div className="prose">
            <PortableText
                value={index.body as unknown as PortableTextBlock[]}
                components={createPortableTextComponents({
                    index,
                    highlightedCode: highlighted,
                    // The same ids the Studio checks 3D-model callout anchors
                    // against, so a callout can link to an essay section.
                    headingIds: headingIdsByKey(extractHeadings(project)),
                })}
                onMissingComponent={false}
            />
            <Footnotes notes={index.notes} />
        </div>
    );
}
