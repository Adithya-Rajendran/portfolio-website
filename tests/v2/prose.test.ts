import { describe, expect, it, vi } from "vitest";
import { env } from "./worker-env";
vi.mock("cloudflare:workers", () => ({ env }));
import { renderProse } from "../../src/lib/prose";
import { highlight } from "../../src/lib/highlight";

describe("public prose", () => {
    it("renders unique heading anchors, escaped code and its filename", async () => {
        const body = [
            {
                _type: "block",
                _key: "h1",
                style: "h2",
                children: [{ _type: "span", text: "Setup" }],
            },
            {
                _type: "block",
                _key: "h2",
                style: "h2",
                children: [{ _type: "span", text: "Setup" }],
            },
            {
                _type: "code",
                _key: "c1",
                code: 'const x = "<tag>";',
                language: "javascript",
                filename: "example.js",
            },
        ];
        const html = renderProse(body, await highlight(body));
        expect(html).toContain('id="setup"');
        expect(html).toContain('id="setup-2"');
        expect(html).toContain("example.js");
        expect(html).not.toContain("<tag>");
        expect(html).toContain('tabindex="0"');
    });
    it("keeps a single numbered note for a repeated annotation", () => {
        const body = [
            {
                _type: "block",
                _key: "p",
                style: "normal",
                markDefs: [
                    { _type: "footnote", _key: "n", text: "A note & source" },
                ],
                children: [
                    { _type: "span", _key: "a", text: "First", marks: ["n"] },
                    {
                        _type: "span",
                        _key: "b",
                        text: " second",
                        marks: ["n", "strong"],
                    },
                ],
            },
        ];
        const html = renderProse(body);
        expect(html).toContain("A note &amp; source");
        expect(html.match(/<li id="fn-/g)).toHaveLength(1);
    });
    it("renders safe links, blocks unsafe links and embeds, and escapes callout text", () => {
        const body = [
            {
                _type: "block",
                _key: "p",
                style: "normal",
                markDefs: [
                    { _type: "link", _key: "bad", href: "javascript:alert(1)" },
                    {
                        _type: "link",
                        _key: "good",
                        href: "https://example.org/",
                    },
                ],
                children: [
                    {
                        _type: "span",
                        _key: "a",
                        text: "bad link",
                        marks: ["bad"],
                    },
                    {
                        _type: "span",
                        _key: "b",
                        text: "good link",
                        marks: ["good"],
                    },
                ],
            },
            {
                _type: "callout",
                _key: "c",
                title: "<script>",
                tone: "note",
                body: [],
            },
            { _type: "mediaEmbed", _key: "m", url: "javascript:alert(1)" },
        ];
        const html = renderProse(body);
        expect(html).not.toContain("javascript:");
        expect(html).not.toContain("<script>");
        expect(html).toContain("&lt;script&gt;");
        expect(html).toContain("https://example.org/");
    });
});
