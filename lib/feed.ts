import {
    toHTML,
    uriLooksSafe,
    type PortableTextHtmlComponents,
} from "@portabletext/to-html";
import { BLOG_DESCRIPTION, siteConfig } from "@/lib/config";
import { urlForImage } from "@/lib/sanity-image";
import type { PostWithBody } from "@/lib/sanity-client";

/** The exact projection consumed by the RSS renderer. */
export type FeedPost = Pick<
    PostWithBody,
    "title" | "slug" | "description" | "publishedAt" | "body"
>;

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
        if (!["http:", "https:", "mailto:"].includes(parsed.protocol)) {
            return null;
        }
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

function renderImage(value: Record<string, unknown>): string {
    if (!value.asset) return "";

    try {
        const src = urlForImage(value)
            .width(1000)
            .fit("max")
            .auto("format")
            .url();
        const alt = typeof value.alt === "string" ? value.alt : "";
        const caption =
            typeof value.caption === "string" && value.caption
                ? `<figcaption>${escapeHtmlText(value.caption)}</figcaption>`
                : "";
        return `<figure><img src="${escapeHtmlAttr(src)}" alt="${escapeHtmlAttr(
            alt,
        )}"/>${caption}</figure>`;
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
 */
const components: Partial<PortableTextHtmlComponents> = {
    types: {
        image: ({ value }) => renderImage(value),
        gallery: ({ value }) => {
            const images = Array.isArray(value?.images)
                ? value.images
                      .filter(
                          (image: unknown): image is Record<string, unknown> =>
                              Boolean(image) && typeof image === "object",
                      )
                      .map(renderImage)
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
            const filename =
                typeof value?.filename === "string" && value.filename
                    ? `<figcaption><code>${escapeHtmlText(value.filename)}</code></figcaption>`
                    : "";
            const language =
                typeof value?.language === "string" && value.language
                    ? ` class="language-${escapeHtmlAttr(value.language)}"`
                    : "";
            return `<figure>${filename}<pre><code${language}>${escapeHtmlText(
                typeof value?.code === "string" ? value.code : "",
            )}</code></pre></figure>`;
        },
        callout: ({ value }) => {
            const title =
                typeof value?.title === "string" && value.title
                    ? `<strong>${escapeHtmlText(value.title)}</strong>`
                    : "";
            const body = Array.isArray(value?.body)
                ? toHTML(value.body, {
                      components,
                      onMissingComponent: false,
                  })
                : "";
            return title || body ? `<aside>${title}${body}</aside>` : "";
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
    },
};

function renderPostHtml(post: FeedPost): string {
    if (!post.body) return "";
    return toHTML(post.body, { components, onMissingComponent: false });
}

export function renderFeedXml(posts: FeedPost[]): string {
    const feedUrl = `${siteConfig.url}${FEED_PATH}`;
    const publishable = posts.filter(
        (post) => post.title && post.slug && SAFE_SLUG.test(post.slug),
    );

    const items = publishable.map((post) => {
        const url = `${siteConfig.url}/blogs/${post.slug}`;
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
        `<link>${escapeXml(`${siteConfig.url}/blogs`)}</link>`,
        `<description>${escapeXml(BLOG_DESCRIPTION)}</description>`,
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
