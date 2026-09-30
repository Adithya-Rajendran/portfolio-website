import { PortableText, type PortableTextComponents } from "@portabletext/react";
import FigurePlate, { type PlateImage } from "@/components/prose/figure-plate";
import Listing from "@/components/prose/listing";
import { postCopy as copy } from "@/lib/copy";
import { resolveLinkMark } from "@/lib/content-links";
import { classifyMediaEmbed } from "@/lib/media-embed";
import {
    calloutHeading,
    hasImageAsset,
    type NumberedFootnote,
    type ProseIndex,
} from "@/lib/prose";

/**
 * The long-read renderers for `contentBody` (G1), shared by the post page
 * and the project essay. They emit the final markup on the server (plan
 * §4.1: no client pass): numbered listings with a Copy button, numbered
 * plates and figures, callouts (`div[role=note]`, never an `aside` inside
 * `main`: the quotation's quiet note, led by its tone and title in bold),
 * footnotes as raised numbers with a margin copy, and headings
 * with the ids the contents and the Studio's callout anchors use. Styles
 * live in styles/prose.css, under `.prose`.
 *
 * Every number comes from `indexProse` (lib/prose.ts), which also feeds
 * the RSS feed, so they agree. Pass its `body`
 * (the footnotes are numbered there) to <PortableText>.
 */
export interface ProseContext {
    index: ProseIndex;
    /** Shiki markup by code block `_key` (lib/highlight-code.ts). */
    highlightedCode: Record<string, string>;
    /** Heading ids by block `_key` (lib/headings.ts). */
    headingIds: Record<string, string>;
}

/**
 * Studio-authored links are `contentLink` markDefs; legacy documents may
 * still carry `link`. Both render through this one safe renderer, and an
 * unsafe or email link prints as its text.
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

const calloutBodyComponents: PortableTextComponents = {
    block: { normal: ({ children }) => <p>{children}</p> },
    marks: {
        strong: ({ children }) => <strong>{children}</strong>,
        em: ({ children }) => <em>{children}</em>,
        code: ({ children }) => <code>{children}</code>,
        contentLink: LinkMark,
        link: LinkMark,
    },
};

function Heading({
    as: Tag,
    id,
    children,
}: {
    as: "h2" | "h3" | "h4";
    id?: string;
    children: React.ReactNode;
}) {
    return <Tag id={id}>{children}</Tag>;
}

export function createPortableTextComponents({
    index,
    highlightedCode,
    headingIds,
}: ProseContext): PortableTextComponents {
    const plate = (value: PlateImage) => {
        const info = value._key ? index.figures[value._key] : undefined;
        if (!info || !hasImageAsset(value)) return null;
        return <FigurePlate value={value} info={info} />;
    };

    /**
     * A footnote: the annotated words, then the raised number linking to
     * the note at the end. On wide screens (styles/prose.css) the note is
     * also set in the margin beside the line; that copy is decorative, so
     * a screen reader hears the note once, in the list.
     */
    function FootnoteMark({
        children,
        value,
    }: {
        children: React.ReactNode;
        value?: unknown;
    }) {
        const number = (value as NumberedFootnote | undefined)?.number;
        const note = number ? index.notes[number - 1] : undefined;
        if (!note) return <>{children}</>;
        return (
            <>
                {children}
                <sup className="fnref" id={note.refId}>
                    <a
                        href={`#${note.id}`}
                        aria-label={copy.notes.ref(note.number)}
                    >
                        {note.number}
                    </a>
                </sup>
                <span className="sidenote" aria-hidden="true">
                    <span className="sidenote__n">{note.number}</span>
                    {note.text}
                </span>
            </>
        );
    }

    return {
        types: {
            image: ({ value }) => plate(value as PlateImage),
            gallery: ({ value }) => {
                const images: PlateImage[] = Array.isArray(value?.images)
                    ? value.images.filter(hasImageAsset)
                    : [];
                const plates = images.map((image) => (
                    <li key={image._key}>{plate(image)}</li>
                ));
                if (!plates.length) return null;
                return (
                    <figure className="gallery">
                        <ul className="gallery__plates" role="list">
                            {plates}
                        </ul>
                        {value.caption ? (
                            <figcaption className="caption">
                                {value.caption}
                            </figcaption>
                        ) : null}
                    </figure>
                );
            },
            callout: ({ value }) => {
                const body = Array.isArray(value?.body) ? value.body : [];
                const title =
                    typeof value?.title === "string" ? value.title.trim() : "";
                if (!body.length && !title) return null;
                // A note, not a landmark: an <aside> inside <main> is a
                // complementary landmark that is not top-level. The tone is
                // said in words, as the feed says it: "Caution: …".
                return (
                    <div className="callout" role="note">
                        <p>
                            <strong>{calloutHeading(value ?? {})}</strong>
                        </p>
                        {body.length > 0 ? (
                            <PortableText
                                value={body}
                                components={calloutBodyComponents}
                                onMissingComponent={false}
                            />
                        ) : null}
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
                        <p className="media-link">
                            <a
                                href={media.href}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {title}
                            </a>
                            <span className="media-link__host">
                                {media.hostname}
                            </span>
                            {value.caption ? (
                                <span className="media-link__caption">
                                    {value.caption}
                                </span>
                            ) : null}
                        </p>
                    );
                return (
                    <figure className="media">
                        <div className="media__frame">
                            <iframe
                                src={media.embedUrl}
                                title={title}
                                loading="lazy"
                                referrerPolicy="strict-origin-when-cross-origin"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                            />
                        </div>
                        {value.caption ? (
                            <figcaption className="caption">
                                {value.caption}
                            </figcaption>
                        ) : null}
                    </figure>
                );
            },
            code: ({ value }) => {
                const info = index.listings[value._key];
                if (!info) return null;
                return (
                    <Listing
                        info={info}
                        code={typeof value.code === "string" ? value.code : ""}
                        html={highlightedCode[value._key]}
                    />
                );
            },
        },
        block: {
            h2: ({ children, value }) => (
                <Heading as="h2" id={headingIds[value._key ?? ""]}>
                    {children}
                </Heading>
            ),
            h3: ({ children, value }) => (
                <Heading as="h3" id={headingIds[value._key ?? ""]}>
                    {children}
                </Heading>
            ),
            h4: ({ children, value }) => (
                <Heading as="h4" id={headingIds[value._key ?? ""]}>
                    {children}
                </Heading>
            ),
            normal: ({ children }) => <p>{children}</p>,
            blockquote: ({ children }) => <blockquote>{children}</blockquote>,
        },
        marks: {
            strong: ({ children }) => <strong>{children}</strong>,
            em: ({ children }) => <em>{children}</em>,
            code: ({ children }) => <code>{children}</code>,
            underline: ({ children }) => <u>{children}</u>,
            "strike-through": ({ children }) => <s>{children}</s>,
            contentLink: LinkMark,
            link: LinkMark,
            footnote: FootnoteMark,
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
