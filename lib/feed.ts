import {
    toHTML,
    uriLooksSafe,
    type PortableTextHtmlComponents,
} from "@portabletext/to-html";
import { siteConfig } from "@/lib/config";
import { urlForImage } from "@/lib/sanity-image";
import { changeKindTitle } from "@/lib/post-fields";
import {
    calloutHeading,
    indexProse,
    type FigureInfo,
    type NumberedFootnote,
    type ProseIndex,
} from "@/lib/prose";
import type { PostWithBody } from "@/lib/sanity-client";

/** The exact projection consumed by the RSS renderer. */
export type FeedPost = Pick<
    PostWithBody,
    "title" | "slug" | "description" | "publishedAt" | "body"
> &
    Partial<Pick<PostWithBody, "changelog">>;

export const FEED_PATH = "/feed.xml";
export const FEED_TITLE = `${siteConfig.author} — Blog`;

const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/;
const XML_ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

function escapeXml(value: string): string {
    return value
        .replace(XML_ILLEGAL, "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * Deliberately avoid @portabletext/to-html's prose-oriented space
 * replacement here: non-breaking spaces would corrupt copied code.
 */
function escapeHtmlText(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function escapeHtmlAttr(value: string): string {
    return escapeHtmlText(value).replace(/"/g, "&quot;");
}

/** Accept both legacy date-only values and the V3 datetime field. */
function toRfc822(value: string): string | null {
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const parsed = new Date(dateOnly ? `${value}T00:00:00Z` : value);
    if (Number.isNaN(parsed.getTime())) return null;
    if (dateOnly && parsed.toISOString().slice(0, 10) !== value) return null;
    return parsed.toUTCString();
}

function safeLinkTarget(href: unknown): string | null {
    if (typeof href !== "string" || !href || !uriLooksSafe(href)) return null;
    if (href.startsWith("/")) return `${siteConfig.url}${href}`;

    try {
        const parsed = new URL(href);
        // No mailto: the site publishes no email address (lib/content-links.ts).
        if (!["http:", "https:"].includes(parsed.protocol)) return null;
        return parsed.toString();
    } catch {
        return null;
    }
}

function safeHttpTarget(url: unknown): string | null {
    if (typeof url !== "string" || !uriLooksSafe(url)) return null;
    try {
        const parsed = new URL(url);
        return ["http:", "https:"].includes(parsed.protocol)
            ? parsed.toString()
            : null;
    } catch {
        return null;
    }
}

function renderImage(
    value: Record<string, unknown>,
    info: FigureInfo | undefined,
): string {
    if (!value.asset) return "";

    try {
        const src = urlForImage(value)
            .width(1000)
            .fit("max")
            .auto("format")
            .url();
        const alt = typeof value.alt === "string" ? value.alt : "";
        const caption =
            typeof value.caption === "string" ? value.caption.trim() : "";
        const credit =
            typeof value.credit === "string" ? value.credit.trim() : "";
        const parts = [
            info ? `<strong>${escapeHtmlText(info.label)}</strong>` : "",
            caption ? escapeHtmlText(caption) : "",
            credit ? `<small>${escapeHtmlText(credit)}</small>` : "",
        ].filter(Boolean);
        const figcaption = parts.length
            ? `<figcaption>${parts.join(" ")}</figcaption>`
            : "";
        return `<figure><img src="${escapeHtmlAttr(src)}" alt="${escapeHtmlAttr(
            alt,
        )}"/>${figcaption}</figure>`;
    } catch {
        return "";
    }
}

function renderLink(
    children: string,
    value: Record<string, unknown> | undefined,
): string {
    const href = safeLinkTarget(value?.href);
    return href
        ? `<a href="${escapeHtmlAttr(href)}">${children}</a>`
        : children;
}

/**
 * Portable Text to conservative feed HTML. Video URLs are links, never
 * iframe markup; malformed links and images degrade to readable text.
 * Listings, plates, figures and footnotes carry the numbers the page
 * prints (lib/prose.ts): "Listing 3 · Bash · install.sh", "Pl. I", and a
 * raised note number that links to the Notes list at the end.
 */
function feedComponents(
    index: ProseIndex,
): Partial<PortableTextHtmlComponents> {
    const components: Partial<PortableTextHtmlComponents> = {
        types: {
            image: ({ value }) =>
                renderImage(
                    value,
                    typeof value?._key === "string"
                        ? index.figures[value._key]
                        : undefined,
                ),
            gallery: ({ value }) => {
                const images = Array.isArray(value?.images)
                    ? value.images
                          .filter(
                              (
                                  image: unknown,
                              ): image is Record<string, unknown> =>
                                  Boolean(image) && typeof image === "object",
                          )
                          .map((image: Record<string, unknown>) =>
                              renderImage(
                                  image,
                                  typeof image._key === "string"
                                      ? index.figures[image._key]
                                      : undefined,
                              ),
                          )
                          .filter(Boolean)
                          .join("")
                    : "";
                if (!images) return "";
                const caption =
                    typeof value?.caption === "string" && value.caption
                        ? `<p>${escapeHtmlText(value.caption)}</p>`
                        : "";
                return `<section>${images}${caption}</section>`;
            },
            code: ({ value }) => {
                const info =
                    typeof value?._key === "string"
                        ? index.listings[value._key]
                        : undefined;
                const filename =
                    typeof value?.filename === "string" && value.filename
                        ? `<code>${escapeHtmlText(value.filename)}</code>`
                        : "";
                const label = info
                    ? [
                          `Listing ${info.number}`,
                          escapeHtmlText(info.language),
                          filename,
                      ]
                          .filter(Boolean)
                          .join(" · ")
                    : filename;
                const figcaption = label
                    ? `<figcaption>${label}</figcaption>`
                    : "";
                const language =
                    typeof value?.language === "string" && value.language
                        ? ` class="language-${escapeHtmlAttr(value.language)}"`
                        : "";
                return `<figure>${figcaption}<pre><code${language}>${escapeHtmlText(
                    typeof value?.code === "string" ? value.code : "",
                )}</code></pre></figure>`;
            },
            callout: ({ value }) => {
                const heading = `<p><strong>${escapeHtmlText(
                    calloutHeading(value ?? {}),
                )}</strong></p>`;
                const body = Array.isArray(value?.body)
                    ? toHTML(value.body, {
                          components,
                          onMissingComponent: false,
                      })
                    : "";
                return `<aside>${heading}${body}</aside>`;
            },
            mediaEmbed: ({ value }) => {
                const href = safeHttpTarget(value?.url);
                const title =
                    typeof value?.title === "string" && value.title
                        ? value.title
                        : href || "Linked media";
                const caption =
                    typeof value?.caption === "string" && value.caption
                        ? `<p>${escapeHtmlText(value.caption)}</p>`
                        : "";
                if (!href) return caption;
                return `<aside><a href="${escapeHtmlAttr(href)}">${escapeHtmlText(
                    title,
                )}</a>${caption}</aside>`;
            },
        },
        marks: {
            contentLink: ({ children, value }) => renderLink(children, value),
            // Keep legacy documents readable during the additive-migration phase.
            link: ({ children, value }) => renderLink(children, value),
            underline: ({ children }) => `<u>${children}</u>`,
            "strike-through": ({ children }) => `<del>${children}</del>`,
            footnote: ({ children, value }) => {
                const number = (value as NumberedFootnote | undefined)?.number;
                const note = number ? index.notes[number - 1] : undefined;
                if (!note) return children;
                return `${children}<sup><a href="#${note.id}" id="${note.refId}">${note.number}</a></sup>`;
            },
        },
    };
    return components;
}

/** The Notes list after the text, each note linking back to its number. */
function renderNotes(index: ProseIndex): string {
    if (!index.notes.length) return "";
    const items = index.notes
        .map(
            (note) =>
                `<li id="${note.id}">${escapeHtmlText(note.text)} <a href="#${note.refId}">↩</a></li>`,
        )
        .join("");
    return `<section><h2>Notes</h2><ol>${items}</ol></section>`;
}

/** The post's recorded updates and corrections, oldest first. */
function renderRevisions(changelog: FeedPost["changelog"]): string {
    const changes = (changelog ?? [])
        .filter((change) => change?.date && change.note)
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    if (!changes.length) return "";
    const items = changes
        .map(
            (change) =>
                `<li><strong>${escapeHtmlText(change.date.slice(0, 10))} · ${escapeHtmlText(
                    changeKindTitle(change.kind),
                )}.</strong> ${escapeHtmlText(change.note)}</li>`,
        )
        .join("");
    return `<section><h2>Revisions</h2><ul>${items}</ul></section>`;
}

function renderPostHtml(post: FeedPost): string {
    if (!post.body) return "";
    const index = indexProse(post.body);
    return (
        toHTML(index.body as typeof post.body, {
            components: feedComponents(index),
            onMissingComponent: false,
        }) +
        renderNotes(index) +
        renderRevisions(post.changelog)
    );
}

/**
 * The feed. RSS requires a channel description: the owner's description
 * of his writing, or the feed's own title when the profile has none.
 */
export function renderFeedXml(
    posts: FeedPost[],
    description?: string | null,
): string {
    const feedUrl = `${siteConfig.url}${FEED_PATH}`;
    const publishable = posts.filter(
        (post) => post.title && post.slug && SAFE_SLUG.test(post.slug),
    );

    const items = publishable.map((post) => {
        const url = `${siteConfig.url}/blog/${post.slug}`;
        const pubDate = toRfc822(post.publishedAt);
        const lines = [
            `<title>${escapeXml(post.title)}</title>`,
            `<link>${escapeXml(url)}</link>`,
            `<guid isPermaLink="true">${escapeXml(url)}</guid>`,
            ...(pubDate ? [`<pubDate>${pubDate}</pubDate>`] : []),
            `<description>${escapeXml(post.description)}</description>`,
            `<content:encoded>${escapeXml(renderPostHtml(post))}</content:encoded>`,
        ];
        return `        <item>\n            ${lines.join("\n            ")}\n        </item>`;
    });

    const newestPublishedAt = publishable.find((post) =>
        toRfc822(post.publishedAt),
    )?.publishedAt;
    const lastBuildDate = newestPublishedAt
        ? toRfc822(newestPublishedAt)
        : null;
    const channelLines = [
        `<title>${escapeXml(FEED_TITLE)}</title>`,
        `<link>${escapeXml(`${siteConfig.url}/blog`)}</link>`,
        `<description>${escapeXml(description?.trim() || FEED_TITLE)}</description>`,
        `<language>en-us</language>`,
        ...(lastBuildDate
            ? [`<lastBuildDate>${lastBuildDate}</lastBuildDate>`]
            : []),
        `<atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>`,
        ...items,
    ];

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
    <channel>
        ${channelLines.join("\n        ")}
    </channel>
</rss>
`;
}
