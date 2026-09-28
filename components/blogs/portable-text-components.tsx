import Image from "next/image";
import { PortableText } from "@portabletext/react";
import { urlForImage } from "@/lib/sanity-image";
import { classifyMediaEmbed } from "@/lib/media-embed";
import type { PortableTextComponents } from "@portabletext/react";
import CopyButton from "@/components/blogs/copy-button";
import { codeListingLabel } from "@/components/blogs/utils";
import { resolveLinkMark } from "@/lib/content-links";

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

/**
 * Studio-authored links are `contentLink` markDefs; legacy documents may
 * still carry `link`. Both render through this one safe renderer.
 */
function LinkMark({
    children,
    value,
}: {
    children: React.ReactNode;
    value?: unknown;
}) {
    const link = resolveLinkMark(value);
    if (!link) return <>{children}</>;
    return (
        <a
            href={link.href}
            {...(link.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
        >
            {children}
        </a>
    );
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
            <div
                className="journal-body-image"
                style={{
                    aspectRatio: `${intrinsicWidth} / ${intrinsicHeight}`,
                }}
            >
                <Image
                    src={imageUrl}
                    alt={value.alt || ""}
                    fill
                    className="object-contain"
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
                <figcaption className="journal-image-caption">
                    {value.caption}
                </figcaption>
            )}
        </figure>
    );
}

const calloutBodyComponents: PortableTextComponents = {
    block: { normal: ({ children }) => <p>{children}</p> },
    marks: {
        strong: ({ children }) => <strong>{children}</strong>,
        em: ({ children }) => <em>{children}</em>,
        code: ({ children }) => (
            <code className="journal-inline-code">{children}</code>
        ),
        contentLink: LinkMark,
        link: LinkMark,
    },
};

function HeadingAnchor({ id }: { id?: string }) {
    return id ? (
        <a
            href={`#${id}`}
            aria-label="Link to this section"
            className="journal-heading-anchor"
        >
            #
        </a>
    ) : null;
}

/**
 * The same precomputed heading ids power the prose anchors and contents
 * links; listing numbers (numberCodeListings) give each code block a unique
 * accessible name.
 */
export function createPortableTextComponents(
    highlightedCode: Record<string, string>,
    headingIds: Record<string, string>,
    codeListingNumbers: Record<string, number> = {},
): PortableTextComponents {
    return {
        types: {
            image: ({ value }) =>
                isBodyImage(value) ? (
                    <div className="journal-media">
                        <BodyImage value={value} />
                    </div>
                ) : null,
            gallery: ({ value }) => {
                const authoredImages: unknown[] = Array.isArray(value?.images)
                    ? value.images
                    : [];
                const images = authoredImages.filter(
                    (image): image is BodyImageValue =>
                        isBodyImage(image) && typeof image._key === "string",
                );
                if (!images.length) return null;
                return (
                    <figure className="journal-media">
                        <div className="journal-gallery">
                            {images.map((image) => (
                                <BodyImage
                                    key={image._key}
                                    value={image}
                                    maxWidth={700}
                                />
                            ))}
                        </div>
                        {value.caption && (
                            <figcaption>{value.caption}</figcaption>
                        )}
                    </figure>
                );
            },
            callout: ({ value }) => {
                const body = Array.isArray(value?.body) ? value.body : [];
                if (!body.length && !value?.title) return null;
                const tone =
                    typeof value?.tone === "string" ? value.tone : "note";
                // A note, not a landmark: an <aside> inside <main> is a
                // complementary landmark that is not top-level.
                return (
                    <div
                        className="journal-callout"
                        data-tone={tone}
                        role="note"
                    >
                        {value.title && (
                            <p className="journal-callout-title">
                                {value.title}
                            </p>
                        )}
                        {body.length > 0 && (
                            <PortableText
                                value={body}
                                components={calloutBodyComponents}
                            />
                        )}
                    </div>
                );
            },
            mediaEmbed: ({ value }) => {
                const media = classifyMediaEmbed(value?.url);
                if (!media) return null;
                const title =
                    typeof value?.title === "string" && value.title
                        ? value.title
                        : `Media from ${media.hostname}`;
                if (media.kind === "link")
                    return (
                        <a
                            href={media.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="journal-media-link"
                        >
                            <strong>
                                {title} <span aria-hidden>↗</span>
                            </strong>
                            <span>{media.hostname}</span>
                            {value.caption && <span>{value.caption}</span>}
                        </a>
                    );
                return (
                    <figure className="journal-media">
                        <div className="journal-video">
                            <iframe
                                src={media.embedUrl}
                                title={title}
                                loading="lazy"
                                referrerPolicy="strict-origin-when-cross-origin"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                            />
                        </div>
                        {value.caption && (
                            <figcaption>{value.caption}</figcaption>
                        )}
                    </figure>
                );
            },
            code: ({ value }) => {
                const highlightedHtml = highlightedCode[value._key];
                // Unique per listing: code regions are landmarks, and
                // landmarks of one role need distinct names.
                const label = codeListingLabel({
                    number: codeListingNumbers[value._key],
                    language: value.language,
                    filename: value.filename,
                });
                return (
                    <div className="journal-code-block">
                        <div className="journal-code-toolbar">
                            <span>{value.language || "code"}</span>
                            {value.filename && (
                                <span
                                    className="journal-code-filename"
                                    title={value.filename}
                                >
                                    {value.filename}
                                </span>
                            )}
                            <CopyButton code={value.code || ""} />
                        </div>
                        {highlightedHtml ? (
                            <div
                                className="journal-code-content shiki-wrapper"
                                tabIndex={0}
                                role="region"
                                aria-label={label}
                                dangerouslySetInnerHTML={{
                                    __html: highlightedHtml,
                                }}
                            />
                        ) : (
                            <pre
                                className="journal-code-content"
                                tabIndex={0}
                                role="region"
                                aria-label={label}
                            >
                                <code>{value.code}</code>
                            </pre>
                        )}
                    </div>
                );
            },
        },
        block: {
            h2: ({ children, value }) => {
                const id = value._key ? headingIds[value._key] : undefined;
                return (
                    <h2 id={id}>
                        {children}
                        <HeadingAnchor id={id} />
                    </h2>
                );
            },
            h3: ({ children, value }) => {
                const id = value._key ? headingIds[value._key] : undefined;
                return (
                    <h3 id={id}>
                        {children}
                        <HeadingAnchor id={id} />
                    </h3>
                );
            },
            h4: ({ children, value }) => {
                const id = value._key ? headingIds[value._key] : undefined;
                return (
                    <h4 id={id}>
                        {children}
                        <HeadingAnchor id={id} />
                    </h4>
                );
            },
            normal: ({ children }) => <p>{children}</p>,
            blockquote: ({ children }) => <blockquote>{children}</blockquote>,
        },
        marks: {
            strong: ({ children }) => <strong>{children}</strong>,
            em: ({ children }) => <em>{children}</em>,
            code: ({ children }) => (
                <code className="journal-inline-code">{children}</code>
            ),
            underline: ({ children }) => <u>{children}</u>,
            "strike-through": ({ children }) => <s>{children}</s>,
            contentLink: LinkMark,
            link: LinkMark,
        },
        list: {
            bullet: ({ children }) => <ul>{children}</ul>,
            number: ({ children }) => <ol>{children}</ol>,
        },
        listItem: {
            bullet: ({ children }) => <li>{children}</li>,
            number: ({ children }) => <li>{children}</li>,
        },
    };
}
