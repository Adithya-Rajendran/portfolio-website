import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LINK_MARK_TYPES, resolveLinkMark } from "@/lib/content-links";
import { indexProse } from "@/lib/prose";
import { createPortableTextComponents } from "@/components/blogs/portable-text-components";

describe("resolveLinkMark", () => {
    it("resolves a Studio contentLink markDef to an external link", () => {
        expect(
            resolveLinkMark({
                _key: "a",
                _type: "contentLink",
                href: "https://kubernetes.io/docs/",
            }),
        ).toEqual({ href: "https://kubernetes.io/docs/", external: true });
    });

    it("resolves a legacy link markDef the same way", () => {
        expect(
            resolveLinkMark({
                _key: "b",
                _type: "link",
                href: "https://example.com/a?b=c",
            }),
        ).toEqual({ href: "https://example.com/a?b=c", external: true });
    });

    it("opens a link to the site itself in place, by its path", () => {
        expect(
            resolveLinkMark({
                href: "https://adithya-rajendran.com/blog/kubernetes-on-the-nvidia-dgx-spark",
            }),
        ).toEqual({
            href: "/blog/kubernetes-on-the-nvidia-dgx-spark",
            external: false,
        });
        expect(
            resolveLinkMark({
                href: "https://www.adithya-rajendran.com/portfolio/homelab?a=b#notes",
            }),
        ).toEqual({ href: "/portfolio/homelab?a=b#notes", external: false });
        expect(
            resolveLinkMark({ href: "https://adithya-rajendran.com" }),
        ).toEqual({ href: "/", external: false });
        // Another host that only starts with the site's name stays external.
        expect(
            resolveLinkMark({
                href: "https://adithya-rajendran.com.evil.test/",
            }),
        ).toEqual({
            href: "https://adithya-rajendran.com.evil.test/",
            external: true,
        });
    });

    it("keeps site-relative paths and fragments internal", () => {
        expect(resolveLinkMark({ href: "/blog/my-homelab" })).toEqual({
            href: "/blog/my-homelab",
            external: false,
        });
        expect(resolveLinkMark({ href: "#networking" })).toEqual({
            href: "#networking",
            external: false,
        });
        expect(resolveLinkMark({ href: "/" })).toEqual({
            href: "/",
            external: false,
        });
    });

    it("publishes no email links: a mailto href renders as plain text", () => {
        expect(
            resolveLinkMark({ href: "mailto:someone@example.com" }),
        ).toBeNull();
        expect(resolveLinkMark({ href: "tel:+15555550100" })).toBeNull();
    });

    it("rejects unsafe or malformed hrefs so the text renders unlinked", () => {
        for (const href of [
            "javascript:alert(1)",
            "data:text/html,hi",
            "vbscript:msgbox(1)",
            "//evil.example/path",
            "/\\evil.example/path",
            "not a url",
            "",
            "   ",
        ]) {
            expect(resolveLinkMark({ href })).toBeNull();
        }
    });

    it("rejects missing values", () => {
        expect(resolveLinkMark(undefined)).toBeNull();
        expect(resolveLinkMark(null)).toBeNull();
        expect(resolveLinkMark({})).toBeNull();
        expect(resolveLinkMark({ href: 42 })).toBeNull();
        expect(resolveLinkMark("https://example.com")).toBeNull();
    });
});

describe("web Portable Text renderer", () => {
    it("renders every link annotation type with the shared link mark", () => {
        const { marks } = createPortableTextComponents({
            index: indexProse([]),
            highlightedCode: {},
            headingIds: {},
        });
        const renderers = LINK_MARK_TYPES.map(
            (type) => (marks as Record<string, unknown> | undefined)?.[type],
        );

        expect(renderers[0]).toBeTypeOf("function");
        expect(new Set(renderers).size).toBe(1);
    });

    it("keeps each run of inline code a line could end inside whole", () => {
        const { marks } = createPortableTextComponents({
            index: indexProse([]),
            highlightedCode: {},
            headingIds: {},
        });
        const code = (marks as Record<string, unknown>).code as ComponentType<{
            text: string;
            children?: ReactNode;
        }>;
        const render = (text: string, children: ReactNode = text) =>
            renderToStaticMarkup(createElement(code, { text }, children));
        const path = "/var/lib/rancher/k3s/agent/containerd/xy.d";

        // A flag is kept whole; a number has no break point.
        expect(render("--gpu-memory-utilization 0.85")).toBe(
            '<code><span class="keep-whole">--gpu-memory-utilization</span> 0.85</code>',
        );
        // Longer than 24 characters, a path may still break.
        expect(path).toHaveLength(42);
        expect(render(path)).toBe(`<code>${path}</code>`);
        // A link inside the code renders as given.
        const link = createElement("a", { href: "/blog/x" }, "a-b");
        expect(render("a-b", link)).toBe(
            '<code><a href="/blog/x">a-b</a></code>',
        );
    });
});
