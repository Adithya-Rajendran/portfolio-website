import { describe, expect, it } from "vitest";
import { renderFeedXml, type FeedPost } from "@/lib/feed";

type Body = NonNullable<FeedPost["body"]>;

function paragraph(text: string, key = "b1"): Body[number] {
    return {
        _type: "block",
        _key: key,
        style: "normal",
        markDefs: [],
        children: [{ _type: "span", _key: `${key}s`, text, marks: [] }],
    } as unknown as Body[number];
}

function linkedParagraph(text: string, href: string): Body[number] {
    return {
        _type: "block",
        _key: "lb",
        style: "normal",
        markDefs: [{ _key: "l1", _type: "link", href }],
        children: [{ _type: "span", _key: "lbs", text, marks: ["l1"] }],
    } as unknown as Body[number];
}

function contentLinkedParagraph(text: string, href: string): Body[number] {
    return {
        _type: "block",
        _key: "clb",
        style: "normal",
        markDefs: [{ _key: "cl1", _type: "contentLink", href }],
        children: [{ _type: "span", _key: "cls", text, marks: ["cl1"] }],
    } as unknown as Body[number];
}

function postOf(overrides: Partial<FeedPost>): FeedPost {
    return {
        title: "A post",
        slug: "a-post",
        description: "A description",
        publishedAt: "2026-01-15T00:00:00.000Z",
        body: [paragraph("Hello world")] as Body,
        ...overrides,
    };
}

describe("renderFeedXml — channel", () => {
    it("renders a valid empty channel when there are no posts (CI fallback path)", () => {
        const xml = renderFeedXml([]);

        expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
        expect(xml).toContain('<rss version="2.0"');
        expect(xml).toContain("<channel>");
        expect(xml).toContain("<title>");
        expect(xml).toContain("<description>");
        expect(xml).toContain("<language>en-us</language>");
        expect(xml).not.toContain("<item>");
        expect(xml).not.toContain("<lastBuildDate>");
    });

    it("includes an atom:link self reference to the feed URL", () => {
        const xml = renderFeedXml([]);

        expect(xml).toContain(
            '<atom:link href="https://adithya-rajendran.com/feed.xml" rel="self" type="application/rss+xml"/>',
        );
    });

    it("uses the newest post date as lastBuildDate", () => {
        const xml = renderFeedXml([
            postOf({
                slug: "new",
                publishedAt: "2026-02-01T12:30:00.000Z",
            }),
            postOf({
                slug: "old",
                publishedAt: "2026-01-01T00:00:00.000Z",
            }),
        ]);

        expect(xml).toContain(
            "<lastBuildDate>Sun, 01 Feb 2026 12:30:00 GMT</lastBuildDate>",
        );
    });
});

describe("renderFeedXml — items", () => {
    it("renders absolute link and permaLink guid per item", () => {
        const xml = renderFeedXml([postOf({ slug: "k8s-deep-dive" })]);

        expect(xml).toContain(
            "<link>https://adithya-rajendran.com/blog/k8s-deep-dive</link>",
        );
        expect(xml).toContain(
            '<guid isPermaLink="true">https://adithya-rajendran.com/blog/k8s-deep-dive</guid>',
        );
    });

    it("formats pubDate as RFC-822 from the published datetime", () => {
        const xml = renderFeedXml([
            postOf({ publishedAt: "2026-01-15T09:45:00.000Z" }),
        ]);

        expect(xml).toContain(
            "<pubDate>Thu, 15 Jan 2026 09:45:00 GMT</pubDate>",
        );
    });

    it("drops posts whose slug fails the safe-slug pattern", () => {
        const xml = renderFeedXml([
            postOf({ slug: "../evil", title: "Evil" }),
            postOf({ slug: "fine", title: "Fine" }),
        ]);

        expect(xml).not.toContain("Evil");
        expect(xml).not.toContain("../");
        expect(xml).toContain("Fine");
    });

    it("escapes XML metacharacters in title and description", () => {
        const xml = renderFeedXml([
            postOf({
                title: 'Zero-days & <script>alert("x")</script>',
                description: "5 < 6 & 7 > 2",
            }),
        ]);

        expect(xml).toContain(
            "<title>Zero-days &amp; &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</title>",
        );
        expect(xml).toContain(
            "<description>5 &lt; 6 &amp; 7 &gt; 2</description>",
        );
        expect(xml).not.toContain("<script>");
    });
});

describe("renderFeedXml — content:encoded", () => {
    it("carries the full body as double-escaped HTML", () => {
        const xml = renderFeedXml([
            postOf({ body: [paragraph("Hello & <world>")] as Body }),
        ]);

        // toHTML escapes the text into HTML, then the XML layer escapes
        // that HTML into the element — so "&" arrives as &amp;amp;.
        expect(xml).toContain("<content:encoded>&lt;p&gt;");
        expect(xml).toContain("Hello &amp;amp; &amp;lt;world&amp;gt;");
    });

    it("escapes code block content so markup inside code can't leak out", () => {
        const xml = renderFeedXml([
            postOf({
                body: [
                    {
                        _type: "code",
                        _key: "c1",
                        language: "typescript",
                        filename: "exploit.ts",
                        code: 'const x = "</content:encoded><script>1</script>";',
                    },
                ] as unknown as Body,
            }),
        ]);

        expect(xml).not.toContain("<script>");
        // The literal close tag from the code must not appear unescaped.
        expect(xml.split("</content:encoded>")).toHaveLength(
            2, // exactly the one real closing tag
        );
        expect(xml).toContain("language-typescript");
        expect(xml).toContain("exploit.ts");
    });

    it("preserves multi-space indentation in code blocks (no &nbsp; collapsing)", () => {
        const xml = renderFeedXml([
            postOf({
                body: [
                    {
                        _type: "code",
                        _key: "c2",
                        language: "python",
                        code: "def f():\n    if True:\n        return 1",
                    },
                ] as unknown as Body,
            }),
        ]);

        expect(xml).not.toContain("nbsp");
        expect(xml).toContain("    if True:");
        expect(xml).toContain("        return 1");
    });

    it("strips XML-illegal control characters instead of emitting them", () => {
        const xml = renderFeedXml([
            postOf({ title: "Terminal\u0007 escape\u001b artifacts" }),
        ]);

        expect(xml).toContain("<title>Terminal escape artifacts</title>");
        expect(xml).not.toContain("\u0007");
        expect(xml).not.toContain("\u001b");
    });

    it("omits pubDate rather than emitting 'Invalid Date' for malformed dates", () => {
        const xml = renderFeedXml([postOf({ publishedAt: "not-a-date" })]);

        expect(xml).not.toContain("Invalid Date");
        expect(xml).not.toContain("<pubDate>");
        expect(xml).not.toContain("<lastBuildDate>");
    });

    it("drops javascript: links but keeps their text", () => {
        const xml = renderFeedXml([
            postOf({
                body: [
                    linkedParagraph("click me", "javascript:alert(1)"),
                ] as Body,
            }),
        ]);

        expect(xml).not.toContain("javascript:");
        expect(xml).toContain("click me");
    });

    it("absolutizes relative links against the site URL", () => {
        const xml = renderFeedXml([
            postOf({
                body: [
                    contentLinkedParagraph("other post", "/blog/other"),
                ] as Body,
            }),
        ]);

        expect(xml).toContain("https://adithya-rajendran.com/blog/other");
    });

    it("renders images as absolute CDN URLs with alt and caption", () => {
        const xml = renderFeedXml([
            postOf({
                body: [
                    {
                        _type: "image",
                        _key: "i1",
                        asset: {
                            _type: "reference",
                            _ref: "image-abc123def456-1000x500-png",
                        },
                        alt: "Rack diagram",
                        caption: "The homelab rack",
                    },
                ] as unknown as Body,
            }),
        ]);

        expect(xml).toContain("https://cdn.sanity.io/");
        expect(xml).toContain("Rack diagram");
        expect(xml).toContain("The homelab rack");
    });

    it("renders media embeds as safe links rather than executable markup", () => {
        const xml = renderFeedXml([
            postOf({
                body: [
                    {
                        _type: "mediaEmbed",
                        _key: "m1",
                        url: "https://www.youtube.com/watch?v=example",
                        title: "A documentary",
                        caption: "Worth revisiting.",
                    },
                ] as unknown as Body,
            }),
        ]);

        expect(xml).toContain("https://www.youtube.com/watch?v=example");
        expect(xml).toContain("A documentary");
        expect(xml).not.toContain("iframe");
        expect(xml).not.toContain("<script");
    });

    it("drops unsafe media URLs while preserving the caption", () => {
        const xml = renderFeedXml([
            postOf({
                body: [
                    {
                        _type: "mediaEmbed",
                        _key: "m2",
                        url: "javascript:alert(1)",
                        caption: "A readable fallback.",
                    },
                ] as unknown as Body,
            }),
        ]);

        expect(xml).not.toContain("javascript:");
        expect(xml).toContain("A readable fallback.");
    });
});
