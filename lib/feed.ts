import {
    toHTML,
    uriLooksSafe,
    type PortableTextHtmlComponents,
} from "@portabletext/to-html";
import { siteConfig } from "@/lib/config";
import { urlForImage } from "@/lib/sanity-image";
import type { Post } from "@/sanity.types";

/**
 * Pure RSS 2.0 renderer — no caching, no I/O, fully unit-testable. The
 * cached wrapper lives in app/feed.xml/route.ts (tagged `post-list`, so
 * the existing Sanity webhook revalidates the feed on every post change).
 *
 * Full post content ships in <content:encoded>: there's no pageview
 * incentive to truncate, and technical-blog readers expect it. All HTML
 * is entity-escaped into the XML (never CDATA — avoids the `]]>`
 * breakout class entirely).
 */

/** Shape the feed needs — matches getRecentPostsWithBody's projection. */
export type FeedPost = Pick<Post, "title" | "description" | "date" | "body"> & {
    slug: string;
};

export const FEED_PATH = "/feed.xml";
export const FEED_TITLE = `${siteConfig.author} — Blog`;
const FEED_DESCRIPTION =
    "Technical deep-dives into cloud infrastructure, cybersecurity, and homelab experiments.";

/** Same defence-in-depth slug gate as actions/warmCache.ts. */
const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Control characters XML 1.0 forbids even when escaped — a single one
 * anywhere in the document makes strict readers reject the whole feed,
 * so they're stripped rather than encoded.
 */
const XML_ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

/** Escape a string for use as an XML text node or attribute value. */
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
 * HTML escapers for the embedded content. NOT @portabletext/to-html's
 * escapeHTML: that helper collapses runs of 2+ spaces into &nbsp;
 * entities — a prose-display heuristic that corrupts indentation inside
 * <pre> (pasting a Python sample from a feed reader would yield
 * U+00A0-polluted, non-runnable code).
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

/**
 * RFC-822 date from the schema's date-only "YYYY-MM-DD" publish date.
 * Returns null for anything else — Studio validates the field, but the
 * mutate API doesn't, and `<pubDate>Invalid Date</pubDate>` would fail
 * reader date parsing.
 */
function toRfc822(date: string): string | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const parsed = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toUTCString();
}

/**
 * Portable Text → HTML for feed readers. Only the non-default renderers:
 * standard blocks (headings, paragraphs, quotes, lists) and strong/em/code
 * marks come from @portabletext/to-html's defaults, which escape all text.
 */
const components: Partial<PortableTextHtmlComponents> = {
    types: {
        image: ({ value }) => {
            if (!value?.asset) return "";
            const src = urlForImage(value)
                .width(1000)
                .fit("max")
                .auto("format")
                .url();
            const caption =
                typeof value.caption === "string" && value.caption
                    ? `<figcaption>${escapeHtmlText(value.caption)}</figcaption>`
                    : "";
            return `<figure><img src="${escapeHtmlAttr(src)}" alt="${escapeHtmlAttr(
                typeof value.alt === "string" ? value.alt : "",
            )}"/>${caption}</figure>`;
        },
        code: ({ value }) => {
            const filename =
                typeof value.filename === "string" && value.filename
                    ? `<figcaption><code>${escapeHtmlText(value.filename)}</code></figcaption>`
                    : "";
            const lang =
                typeof value.language === "string" && value.language
                    ? ` class="language-${escapeHtmlAttr(value.language)}"`
                    : "";
            // Plain <pre><code> — no shiki markup; readers restyle anyway.
            return `<figure>${filename}<pre><code${lang}>${escapeHtmlText(
                typeof value.code === "string" ? value.code : "",
            )}</code></pre></figure>`;
        },
    },
    marks: {
        link: ({ children, value }) => {
            const href = typeof value?.href === "string" ? value.href : "";
            // uriLooksSafe blocks javascript:/data: schemes; keep the text
            // when the target is unusable rather than dropping content.
            if (!href || !uriLooksSafe(href)) return children;
            const absolute = href.startsWith("/")
                ? `${siteConfig.url}${href}`
                : href;
            return `<a href="${escapeHtmlAttr(absolute)}">${children}</a>`;
        },
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
        const pubDate = post.date ? toRfc822(post.date) : null;
        const lines = [
            `<title>${escapeXml(post.title ?? "")}</title>`,
            `<link>${escapeXml(url)}</link>`,
            `<guid isPermaLink="true">${escapeXml(url)}</guid>`,
            ...(pubDate ? [`<pubDate>${pubDate}</pubDate>`] : []),
            `<description>${escapeXml(post.description ?? "")}</description>`,
            `<content:encoded>${escapeXml(renderPostHtml(post))}</content:encoded>`,
        ];
        return `        <item>\n            ${lines.join("\n            ")}\n        </item>`;
    });

    // Posts arrive newest-first; the newest publish date doubles as the
    // channel's last-build marker so the renderer never reads the clock.
    const newestDate = publishable.find((post) => post.date)?.date;
    const lastBuildDate = newestDate ? toRfc822(newestDate) : null;

    const channelLines = [
        `<title>${escapeXml(FEED_TITLE)}</title>`,
        `<link>${escapeXml(`${siteConfig.url}/blogs`)}</link>`,
        `<description>${escapeXml(FEED_DESCRIPTION)}</description>`,
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
