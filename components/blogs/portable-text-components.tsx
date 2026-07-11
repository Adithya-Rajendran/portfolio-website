import Image from "next/image";
import { PortableText } from "@portabletext/react";
import { urlForImage } from "@/lib/sanity-image";
import { classifyMediaEmbed } from "@/lib/media-embed";
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

type BodyImageValue = BodyImageMeta & {
    _key?: string;
    asset?: { _ref?: string };
    alt?: string;
    caption?: string;
};

function isBodyImage(value: unknown): value is BodyImageValue {
    if (!value || typeof value !== "object") return false;
    const asset = (value as { asset?: unknown }).asset;
    return (
        !!asset &&
        typeof asset === "object" &&
        typeof (asset as { _ref?: unknown })._ref === "string"
    );
}

function safeContentHref(value: unknown): string | null {
    if (typeof value !== "string" || value.length === 0) return null;
    if (value.startsWith("/") || value.startsWith("#")) return value;

    try {
        const url = new URL(value);
        return ["http:", "https:", "mailto:"].includes(url.protocol)
            ? url.href
            : null;
    } catch {
        return null;
    }
}

function BodyImage({
    value,
    maxWidth = 1000,
}: {
    value: BodyImageValue;
    maxWidth?: number;
}) {
    const imageUrl = urlForImage(value)
        .width(maxWidth)
        .fit("max")
        .auto("format")
        .url();
    const intrinsicWidth = value.dimensions?.width || maxWidth;
    const intrinsicHeight =
        value.dimensions?.height || Math.round(maxWidth / 2);
    const width = Math.min(maxWidth, intrinsicWidth);
    const height = Math.round(intrinsicHeight * (width / intrinsicWidth));
    const aspectRatio = intrinsicWidth / intrinsicHeight;
    const isPortrait = aspectRatio < 0.9;
    const isSquare = aspectRatio >= 0.9 && aspectRatio <= 1.1;
    const figureWidth = isPortrait
        ? "mx-auto max-w-[28rem]"
        : isSquare
          ? "mx-auto max-w-[34rem]"
          : "w-full";
    const responsiveSizes = isPortrait
        ? "(max-width: 639px) calc(100vw - 3rem), 28rem"
        : isSquare
          ? "(max-width: 639px) calc(100vw - 3rem), 34rem"
          : "(max-width: 639px) calc(100vw - 3rem), (max-width: 1023px) min(calc(100vw - 4rem), 42.5rem), 42.5rem";

    return (
        <figure className={figureWidth}>
            <div className="overflow-hidden rounded-[1rem] bg-slate-100/70 dark:bg-white/[0.035]">
                <Image
                    src={imageUrl}
                    alt={value.alt || ""}
                    width={width}
                    height={height}
                    className="mx-auto h-auto max-h-[min(72svh,44rem)] w-auto max-w-full object-contain"
                    loading="lazy"
                    sizes={responsiveSizes}
                    {...(value.lqip
                        ? {
                              placeholder: "blur" as const,
                              blurDataURL: value.lqip,
                          }
                        : {})}
                />
            </div>
            {value.caption && (
                <figcaption className="mt-3 text-center text-sm italic text-slate-600 dark:text-slate-400">
                    {value.caption}
                </figcaption>
            )}
        </figure>
    );
}

const calloutBodyComponents: PortableTextComponents = {
    block: {
        normal: ({ children }) => (
            <p className="my-2 leading-relaxed text-slate-700 dark:text-slate-300">
                {children}
            </p>
        ),
    },
    marks: {
        strong: ({ children }) => (
            <strong className="font-semibold text-slate-900 dark:text-white">
                {children}
            </strong>
        ),
        em: ({ children }) => <em>{children}</em>,
        code: ({ children }) => (
            <code className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[0.875em] dark:bg-white/10">
                {children}
            </code>
        ),
        link: ({ children, value }) => {
            const href = safeContentHref(value?.href);
            if (!href) return <>{children}</>;
            const isExternal = /^https?:\/\//.test(href);
            return (
                <a
                    href={href}
                    className="text-accent underline decoration-1 underline-offset-2 transition-opacity hover:opacity-80"
                    {...(isExternal
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                >
                    {children}
                </a>
            );
        },
    },
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
                if (!isBodyImage(value)) return null;
                return (
                    <div className="my-10">
                        <BodyImage value={value} />
                    </div>
                );
            },
            gallery: ({ value }) => {
                const authoredImages: unknown[] = Array.isArray(value?.images)
                    ? value.images
                    : [];
                const images = authoredImages.filter(
                    (image): image is BodyImageValue =>
                        isBodyImage(image) && typeof image._key === "string",
                );
                if (images.length === 0) return null;

                return (
                    <figure className="my-10">
                        <div className="grid gap-4 sm:grid-cols-2">
                            {images.map((image) => (
                                <BodyImage
                                    key={image._key}
                                    value={image}
                                    maxWidth={700}
                                />
                            ))}
                        </div>
                        {value.caption && (
                            <figcaption className="mt-4 text-center text-sm italic text-slate-600 dark:text-slate-400">
                                {value.caption}
                            </figcaption>
                        )}
                    </figure>
                );
            },
            callout: ({ value }) => {
                const body = Array.isArray(value?.body) ? value.body : [];
                if (body.length === 0 && !value?.title) return null;

                const tone =
                    typeof value?.tone === "string" ? value.tone : "note";
                const toneClasses =
                    tone === "warning"
                        ? "border-amber-500/70 bg-amber-500/8"
                        : tone === "success" || tone === "tip"
                          ? "border-emerald-500/70 bg-emerald-500/8"
                          : "border-accent bg-accent-soft";

                return (
                    <aside
                        className={`my-8 border-l-4 px-5 py-4 sm:px-6 ${toneClasses}`}
                    >
                        {value.title && (
                            <p className="font-display font-semibold text-slate-900 dark:text-white">
                                {value.title}
                            </p>
                        )}
                        {body.length > 0 && (
                            <PortableText
                                value={body}
                                components={calloutBodyComponents}
                            />
                        )}
                    </aside>
                );
            },
            mediaEmbed: ({ value }) => {
                const media = classifyMediaEmbed(value?.url);
                if (!media) return null;
                const title =
                    typeof value?.title === "string" && value.title
                        ? value.title
                        : `Media from ${media.hostname}`;

                if (media.kind === "link") {
                    return (
                        <a
                            href={media.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="my-8 block border-y border-slate-400/25 py-5 transition-colors hover:border-accent dark:border-white/10"
                        >
                            <span className="block font-display font-semibold text-slate-900 dark:text-white">
                                {title}
                            </span>
                            <span className="mt-1 block break-all font-term text-xs text-accent">
                                {media.hostname}
                            </span>
                            {value.caption && (
                                <span className="mt-3 block text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                                    {value.caption}
                                </span>
                            )}
                        </a>
                    );
                }

                return (
                    <figure className="my-10">
                        <div className="aspect-video overflow-hidden os-card-flat">
                            <iframe
                                src={media.embedUrl}
                                title={title}
                                loading="lazy"
                                referrerPolicy="strict-origin-when-cross-origin"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                                className="h-full w-full border-0"
                            />
                        </div>
                        {value.caption && (
                            <figcaption className="mt-4 text-center text-sm italic text-slate-600 dark:text-slate-400">
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
                const href = safeContentHref(value?.href);
                if (!href) return <>{children}</>;
                const isExternal = /^https?:\/\//.test(href);
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
