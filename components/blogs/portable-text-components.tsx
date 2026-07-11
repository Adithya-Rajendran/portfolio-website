import Image from "next/image";
import { urlForImage } from "@/lib/sanity-image";
import type { PortableTextComponents } from "@portabletext/react";
import CopyButton from "@/components/blogs/copy-button";

/**
 * GROQ-derived fields the postProjection joins onto body images
 * (asset->metadata) — not part of the generated schema types.
 */
type BodyImageMeta = {
    lqip?: string | null;
    dimensions?: { width?: number; height?: number } | null;
};

/** Hover-revealed anchor link on headings; ids come from extractHeadings. */
function HeadingAnchor({ id }: { id?: string }) {
    if (!id) return null;
    return (
        <a
            href={`#${id}`}
            aria-label="Link to this section"
            className="ml-2 text-accent no-underline font-normal opacity-0 group-hover:opacity-70 focus-visible:opacity-100 transition-opacity"
        >
            #
        </a>
    );
}

/**
 * Factory that creates portable text components for blog post bodies.
 * Accepts a map of pre-highlighted code HTML (key → html) produced by
 * shiki on the server, plus a block-_key → anchor-id map produced by
 * extractHeadings so the rendered heading ids are byte-identical to the
 * ToC links (single slugification path).
 *
 * Accent-colored marks (h2 line, inline code, links) pull from the
 * active theme via the `text-accent` / `bg-accent-soft` utilities.
 */
export function createPortableTextComponents(
    highlightedCode: Record<string, string>,
    headingIds: Record<string, string>,
): PortableTextComponents {
    return {
        types: {
            image: ({ value }) => {
                if (!value?.asset?._ref) return null;
                const imageUrl = urlForImage(value)
                    .width(1000)
                    .fit("max")
                    .auto("format")
                    .url();
                // Real intrinsic ratio (from asset->metadata in the
                // projection) prevents layout shift; the LQIP gives a
                // blur-up placeholder. Both fall back gracefully for
                // cached/older query results without the join.
                const meta = value as BodyImageMeta;
                const intrinsicWidth = meta.dimensions?.width || 1000;
                const intrinsicHeight = meta.dimensions?.height || 500;
                const width = Math.min(1000, intrinsicWidth);
                const height = Math.round(
                    intrinsicHeight * (width / intrinsicWidth),
                );
                return (
                    <figure className="my-10">
                        <div className="overflow-hidden os-card-flat">
                            <Image
                                src={imageUrl}
                                alt={value.alt || "Blog post image"}
                                width={width}
                                height={height}
                                className="w-full h-auto"
                                style={{ objectFit: "scale-down" }}
                                loading="lazy"
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 75vw, 1000px"
                                {...(meta.lqip
                                    ? {
                                          placeholder: "blur" as const,
                                          blurDataURL: meta.lqip,
                                      }
                                    : {})}
                            />
                        </div>
                        {value.caption && (
                            <figcaption className="text-center text-sm text-slate-600 dark:text-slate-400 mt-4 italic">
                                {value.caption}
                            </figcaption>
                        )}
                    </figure>
                );
            },
            code: ({ value }) => {
                const highlightedHtml = highlightedCode[value._key];
                const hasHighlight = !!highlightedHtml;

                return (
                    <div className="my-8 os-card-flat overflow-hidden">
                        <div className="bg-slate-100/80 dark:bg-white/[0.04] px-4 py-2.5 flex items-center gap-3 border-b border-slate-200/80 dark:border-white/10">
                            <span className="inline-flex items-center rounded-full bg-slate-200/80 dark:bg-white/[0.08] px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase text-slate-600 dark:text-slate-300 shrink-0">
                                {value.language || "code"}
                            </span>
                            {value.filename && (
                                <span className="text-xs text-slate-600 dark:text-slate-400 font-mono truncate">
                                    {value.filename}
                                </span>
                            )}
                            <div className="ml-auto">
                                <CopyButton code={value.code || ""} />
                            </div>
                        </div>

                        {hasHighlight ? (
                            <div
                                className="shiki-wrapper text-sm overflow-x-auto [&_pre]:!bg-transparent [&_pre]:p-5 [&_pre]:m-0 [&_code]:font-mono [&_code]:leading-relaxed bg-[#f6f8fa] dark:bg-[#11131c]"
                                dangerouslySetInnerHTML={{
                                    __html: highlightedHtml,
                                }}
                            />
                        ) : (
                            <pre className="bg-[#f6f8fa] dark:bg-[#11131c] text-slate-800 dark:text-slate-200 text-sm p-5 overflow-x-auto">
                                <code className="font-mono leading-relaxed">
                                    {value.code}
                                </code>
                            </pre>
                        )}
                    </div>
                );
            },
        },
        block: {
            // Heading ids come from the precomputed _key → id map so they
            // always match the ToC; headings the ToC skipped (empty text)
            // simply render without an id.
            h2: ({ children, value }) => {
                const id = value._key ? headingIds[value._key] : undefined;
                return (
                    <h2
                        id={id}
                        className="group font-display text-2xl sm:text-3xl font-bold mt-[3.25rem] mb-[1.1rem] text-balance text-slate-900 dark:text-white relative scroll-mt-24"
                    >
                        <span className="absolute -left-4 top-1 bottom-1 w-1 bg-accent-gradient-vertical rounded-full hidden sm:block" />
                        {children}
                        <HeadingAnchor id={id} />
                    </h2>
                );
            },
            h3: ({ children, value }) => {
                const id = value._key ? headingIds[value._key] : undefined;
                return (
                    <h3
                        id={id}
                        className="group font-display text-xl sm:text-2xl font-bold mt-[2.4rem] mb-[0.85rem] text-balance text-slate-900 dark:text-white scroll-mt-24"
                    >
                        {children}
                        <HeadingAnchor id={id} />
                    </h3>
                );
            },
            h4: ({ children, value }) => {
                const id = value._key ? headingIds[value._key] : undefined;
                return (
                    <h4
                        id={id}
                        className="group font-display text-lg sm:text-xl font-semibold mt-8 mb-3 text-slate-900 dark:text-white scroll-mt-24"
                    >
                        {children}
                        <HeadingAnchor id={id} />
                    </h4>
                );
            },
            normal: ({ children }) => (
                <p className="my-5 text-[1.0625rem] leading-[1.75] text-slate-700 dark:text-slate-300">
                    {children}
                </p>
            ),
            blockquote: ({ children }) => (
                <blockquote className="relative my-10 pl-8 pr-6 py-6 border-l-4 border-accent bg-accent-soft rounded-r-xl">
                    <svg
                        className="absolute top-4 left-4 w-8 h-8 text-accent opacity-30"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                    </svg>
                    <div className="relative italic text-slate-700 dark:text-slate-300 text-lg leading-relaxed">
                        {children}
                    </div>
                </blockquote>
            ),
        },
        marks: {
            strong: ({ children }) => (
                <strong className="font-bold text-slate-900 dark:text-white">
                    {children}
                </strong>
            ),
            em: ({ children }) => (
                <em className="italic text-slate-700 dark:text-slate-300">
                    {children}
                </em>
            ),
            code: ({ children }) => (
                <code className="text-accent bg-accent-soft rounded-md px-1.5 py-0.5 font-mono text-[0.875em] border border-accent-soft">
                    {children}
                </code>
            ),
            underline: ({ children }) => (
                <u className="underline decoration-2">{children}</u>
            ),
            "strike-through": ({ children }) => (
                <s className="line-through text-slate-600 dark:text-slate-400">
                    {children}
                </s>
            ),
            link: ({ children, value }) => {
                const href = value?.href || "";
                const isExternal =
                    href.startsWith("http://") || href.startsWith("https://");
                return (
                    <a
                        href={href}
                        className="text-accent hover:opacity-80 underline decoration-1 underline-offset-2 transition-opacity"
                        {...(isExternal
                            ? { target: "_blank", rel: "noopener noreferrer" }
                            : {})}
                    >
                        {children}
                    </a>
                );
            },
        },
        list: {
            bullet: ({ children }) => (
                <ul className="list-disc my-6 ml-6 space-y-3 text-[1.0625rem] text-slate-700 dark:text-slate-300 marker:text-accent">
                    {children}
                </ul>
            ),
            number: ({ children }) => (
                <ol className="list-decimal my-6 ml-6 space-y-3 text-[1.0625rem] text-slate-700 dark:text-slate-300 marker:text-accent">
                    {children}
                </ol>
            ),
        },
        listItem: {
            bullet: ({ children }) => (
                <li className="ml-2 leading-relaxed">{children}</li>
            ),
            number: ({ children }) => (
                <li className="ml-2 leading-relaxed">{children}</li>
            ),
        },
    };
}
