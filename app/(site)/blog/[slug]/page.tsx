import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortableText } from "@portabletext/react";
import ArticleContinuation from "@/components/blogs/article-continuation";
import EndMatter from "@/components/blogs/end-matter";
import { createPortableTextComponents } from "@/components/blogs/portable-text-components";
import { PostCrumb, PostHead } from "@/components/blogs/post-head";
import { PostBox, PostRail } from "@/components/blogs/post-rail";
import PostReader from "@/components/blogs/post-reader";
import styles from "@/components/blogs/post.module.css";
import { BlogPostJsonLd, BreadcrumbJsonLd } from "@/components/json-ld";
import { siteConfig } from "@/lib/config";
import { postCopy as copy } from "@/lib/copy";
import { feedAlternates } from "@/lib/feed";
import {
    contentsHeadings,
    extractHeadings,
    headingIdsByKey,
} from "@/lib/headings";
import { highlightCodeBlocks, type CodeBlock } from "@/lib/highlight-code";
import { logEntries } from "@/lib/log-index";
import { originalEntries } from "@/lib/missions";
import { siteRoutes } from "@/lib/navigation";
import { getProfileLink } from "@/lib/profile-content";
import FigurePlate from "@/components/prose/figure-plate";
import {
    hasImageAsset,
    indexProse,
    LEAD_KEY,
    leadPlateIndex,
} from "@/lib/prose";
import { adjacentEntries, relatedEntries } from "@/lib/related-posts";
import {
    getAllPosts,
    getAllProjects,
    getAllSlugs,
    getPostBySlug,
    getProfile,
} from "@/lib/sanity-client";
import { urlForImage } from "@/lib/sanity-image";
import { notFoundMetadata, shareImage } from "@/lib/site-metadata";
import { TAG_PATTERN } from "@/lib/tags";
import { readingTimeFromWordCount } from "@/components/blogs/utils";

/**
 * Partial Prefetching for this route only (plan §4.6 rule 8, measured in
 * PR 9): the entry links on a list share one prefetched App Shell instead
 * of each prefetching its own post, and the post's content loads on the
 * click. The app-wide flag stays off (next.config.mjs).
 */
export const prefetch = "partial";

/**
 * Prerender every published post at build time; unknown slugs still
 * render on demand (dynamicParams default). Cache Components requires
 * at least one param at build time, so when Sanity is unconfigured
 * (CI's fallback sentinel) or has no posts we emit a placeholder slug
 * that prerenders as the 404 page and is linked from nowhere.
 */
export async function generateStaticParams() {
    const slugs = await getAllSlugs();
    if (slugs.length === 0) return [{ slug: "placeholder" }];
    return slugs.map((slug) => ({ slug }));
}

function isCodeBlock(value: unknown): value is CodeBlock {
    if (!value || typeof value !== "object") return false;
    const block = value as { _type?: unknown; _key?: unknown };
    return block._type === "code" && typeof block._key === "string";
}

function coverUrl(cover: Parameters<typeof urlForImage>[0] | null | undefined) {
    if (!cover || !(cover as { asset?: unknown }).asset) return undefined;
    try {
        return urlForImage(cover).width(1200).fit("max").auto("format").url();
    } catch {
        return undefined;
    }
}

/**
 * An entry (G1, the paper-grade post). One grid: the crumb row (Writing),
 * the head (date · read time · Updated, the title, the standfirst) in the
 * reading column with the first paragraph in the first screen, the
 * sticky contents beside it (a closed box above the text on phones) once
 * there are two sections, the text at a 68ch measure with listings,
 * plates, quiet notes and margin notes, then the end matter (notes,
 * revisions, the end mark and the follow line) and what comes after
 * (previous and next, the project, related entries). The
 * footer carries the author. No ambient motion. Everything is
 * server-rendered; PostReader marks the current section and keeps
 * in-page links inside the visible entry, and the listings' Copy needs
 * JavaScript. Ported from the mockup's post.html.
 */
export default async function BlogPostPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const post = await getPostBySlug(slug);
    if (!post) notFound();

    const codeBlocks = (post.body ?? []).filter(isCodeBlock);
    const [posts, projects, profile, highlighted] = await Promise.all([
        getAllPosts(),
        getAllProjects(),
        getProfile(),
        highlightCodeBlocks(codeBlocks, slug),
    ]);

    const entries = logEntries(posts);
    const headings = extractHeadings(post);
    // The cover, when there is one, is the lead plate after the first
    // paragraph.
    const lead = post.cover && hasImageAsset(post.cover) ? post.cover : null;
    const index = indexProse(post.body, { lead });
    const leadInfo = lead ? index.figures[LEAD_KEY] : undefined;
    const split = leadInfo ? leadPlateIndex(index.body) : index.body.length;
    const components = createPortableTextComponents({
        index,
        highlightedCode: highlighted,
        headingIds: headingIdsByKey(headings),
    });
    const contents = contentsHeadings(headings);
    const readMinutes =
        post.wordCount > 0 ? readingTimeFromWordCount(post.wordCount) : null;
    const tags = (post.tags ?? []).filter((tag) => TAG_PATTERN.test(tag));
    const linkedIn = getProfileLink(profile, "linkedin");
    // The projects the entry names, then those that name it as their
    // write-up (a project's link to it), as each project's page does.
    const originals = originalEntries(projects, posts, entries, siteConfig.url);
    const missions = [
        ...new Set([
            ...(post.projectIds ?? []),
            ...projects
                .filter((project) => originals.get(project._id)?.slug === slug)
                .map((project) => project._id),
        ]),
    ]
        .map((id) => projects.find((project) => project._id === id))
        .filter((project) => project !== undefined);
    const { previous, next } = adjacentEntries(entries, slug);
    const related = relatedEntries(entries, slug, {
        exclude: [previous?.slug, next?.slug].filter((value): value is string =>
            Boolean(value),
        ),
    });
    const url = `${siteConfig.url}/blog/${slug}`;
    const revised = post.revisedAt?.slice(0, 10) ?? null;

    return (
        <div data-page="post" className={styles.page}>
            <BlogPostJsonLd
                title={post.title || ""}
                description={post.description || ""}
                publishedAt={post.publishedAt || ""}
                slug={slug}
                revisedAt={revised}
                tags={tags}
                wordCount={post.wordCount}
                imageUrl={coverUrl(post.cover)}
            />
            <BreadcrumbJsonLd
                items={[
                    { name: "Home", path: siteRoutes.home },
                    { name: copy.plain, path: siteRoutes.blog },
                    { name: post.title, path: `/blog/${slug}` },
                ]}
            />

            <div className={`shell ${styles.printHead}`} data-print="only">
                <p className="label">{copy.plain}</p>
                <p className="data">
                    {[
                        url.replace(/^https?:\/\//, ""),
                        profile?.name || siteConfig.author,
                    ]
                        .filter(Boolean)
                        .join(" · ")}
                </p>
            </div>

            <article className={`shell ${styles.layout}`}>
                <PostCrumb className={styles.crumbRow} />
                <PostHead
                    className={styles.head}
                    title={post.title}
                    description={post.description}
                    publishedAt={post.publishedAt}
                    revisedAt={revised}
                    readMinutes={readMinutes}
                />
                <PostRail className={styles.rail} headings={contents} />
                <div className={styles.main}>
                    <PostBox className={styles.box} headings={contents} />
                    <div className={`prose ${styles.body}`}>
                        <PortableText
                            value={index.body.slice(0, split)}
                            components={components}
                            onMissingComponent={false}
                        />
                        {lead && leadInfo ? (
                            <FigurePlate
                                value={{ ...lead, width: "wide" }}
                                info={leadInfo}
                                priority
                            />
                        ) : null}
                        {split < index.body.length ? (
                            <PortableText
                                value={index.body.slice(split)}
                                components={components}
                                onMissingComponent={false}
                            />
                        ) : null}
                    </div>
                    <EndMatter
                        className={styles.after}
                        notes={index.notes}
                        changelog={post.changelog ?? []}
                        linkedIn={linkedIn}
                    />
                </div>
            </article>

            <ArticleContinuation
                className={`shell ${styles.endSec}`}
                missions={missions}
                previous={previous}
                next={next}
                related={related}
            />
            <PostReader />
        </div>
    );
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    // The page's own read: one cache entry and one Sanity request per post
    // (the share image reads the smaller meta query).
    const post = await getPostBySlug(slug);
    if (!post) return notFoundMetadata;
    const url = `${siteConfig.url}/blog/${slug}`;
    return {
        title: post.title,
        description: post.description,
        ...(post.tags && post.tags.length > 0 && { keywords: post.tags }),
        alternates: feedAlternates(url),
        openGraph: {
            title: post.title,
            description: post.description,
            type: "article",
            publishedTime: post.publishedAt,
            ...(post.revisedAt ? { modifiedTime: post.revisedAt } : {}),
            ...(post.tags && post.tags.length > 0 ? { tags: post.tags } : {}),
            // A profile's address, as Open Graph asks: About.
            authors: [`${siteConfig.url}${siteRoutes.about}`],
            url,
            images: [
                shareImage(
                    "app/(site)/blog/[slug]/opengraph-image.tsx",
                    `${post.title} by ${siteConfig.author}`,
                    slug,
                ),
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: post.title || undefined,
            description: post.description || undefined,
        },
        robots: {
            index: true,
            follow: true,
        },
    };
}
