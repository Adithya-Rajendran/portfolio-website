import { toHTML } from "@portabletext/to-html";
import { createImageUrlBuilder } from "@sanity/image-url";
import { env } from "cloudflare:workers";
import { resolveLinkMark } from "../../lib/content-links";
import { classifyMediaEmbed } from "../../lib/media-embed";
import type { ContentBody } from "./sanity";
import { extractHeadings } from "../../lib/headings";
import { indexProse, calloutHeading } from "../../lib/prose";

const escape = (v: unknown) =>
    String(v ?? "").replace(
        /[&<>"']/g,
        (c) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[c]!,
    );
const config = env as unknown as Record<string, string | undefined>;
const builder = createImageUrlBuilder({
    projectId: config.SANITY_PROJECT_ID || "fallback",
    dataset: config.SANITY_DATASET || "production",
});
function figure(value: any): string {
    if (!value?.asset?._ref) return "";
    const url = builder.image(value).width(1400).url();
    const dimensions =
        value.dimensions?.width > 0 && value.dimensions?.height > 0
            ? ` width="${Number(value.dimensions.width)}" height="${Number(value.dimensions.height)}"`
            : "";
    const srcset = [480, 800, 1400]
        .map((width) => `${builder.image(value).width(width).url()} ${width}w`)
        .join(", ");
    return `<figure><img src="${escape(url)}" srcset="${escape(srcset)}" sizes="(max-width: 700px) 100vw, 700px" alt="${escape(value.alt)}" loading="lazy"${dimensions}>${value.caption || value.credit ? `<figcaption>${escape([value.caption, value.credit].filter(Boolean).join(" · "))}</figcaption>` : ""}</figure>`;
}
export function renderProse(
    body: ContentBody,
    highlighted: Record<string, string> = {},
): string {
    const index = indexProse(body);
    const ids = new Map(extractHeadings({ body }).map((h) => [h.key, h.id]));
    const html = toHTML(index.body as any, {
        components: {
            types: {
                image: ({ value }: any) => figure(value),
                gallery: ({ value }: any) =>
                    `<div class="gallery">${(value.images || []).map(figure).join("")}${value.caption ? `<p>${escape(value.caption)}</p>` : ""}</div>`,
                code: ({ value }: any) => {
                    const info = index.listings[value._key];
                    return `<figure class="listing">${info?.caption ? `<figcaption>${escape(info.caption)}</figcaption>` : ""}<button class="copy-code" type="button" hidden>Copy code</button><span class="copy-status" role="status"></span><div tabindex="0" role="region" aria-label="${escape(info?.label || "Code listing")}">${highlighted[value._key] || `<pre><code>${escape(value.code)}</code></pre>`}</div></figure>`;
                },
                callout: ({ value }: any) =>
                    `<aside role="note"><strong>${escape(calloutHeading(value))}</strong>${renderProse(value.body || [])}</aside>`,
                mediaEmbed: ({ value }: any) => {
                    const media = classifyMediaEmbed(value.url);
                    if (!media) return "";
                    const label = escape(value.title || media.hostname);
                    return media.kind === "link"
                        ? `<p><a href="${escape(media.href)}">${label}</a></p>`
                        : `<figure><iframe src="${escape(media.embedUrl)}" title="${label}" loading="lazy" allowfullscreen></iframe><figcaption>${escape(value.caption)}</figcaption></figure>`;
                },
            },
            block: {
                h2: ({ children, value }: any) =>
                    `<h2 id="${escape(ids.get(value._key))}">${children}</h2>`,
                h3: ({ children, value }: any) =>
                    `<h3 id="${escape(ids.get(value._key))}">${children}</h3>`,
                h4: ({ children, value }: any) =>
                    `<h4 id="${escape(ids.get(value._key))}">${children}</h4>`,
            },
            marks: {
                link: ({ children, value }: any) => {
                    const link = resolveLinkMark(value);
                    return link
                        ? `<a href="${escape(link.href)}">${children}</a>`
                        : children;
                },
                contentLink: ({ children, value }: any) => {
                    const link = resolveLinkMark(value);
                    return link
                        ? `<a href="${escape(link.href)}">${children}</a>`
                        : children;
                },
                footnote: ({ children, value }: any) => {
                    const note = index.notes[(value?.number || 0) - 1];
                    return note
                        ? `${children}<sup><a href="#${escape(note.id)}" id="${escape(note.refId)}">${note.number}</a></sup>`
                        : children;
                },
            },
        },
        onMissingComponent: false,
    });
    return (
        html +
        (index.notes.length
            ? `<section><h2>Notes</h2><ol>${index.notes.map((note) => `<li id="${escape(note.id)}">${escape(note.text)} <a href="#${escape(note.refId)}">↩</a></li>`).join("")}</ol></section>`
            : "")
    );
}
