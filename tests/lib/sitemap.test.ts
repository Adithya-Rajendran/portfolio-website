import { describe, expect, it } from "vitest";
import { renderSitemapXml, sitemapEntries } from "@/lib/sitemap";

const SITE = "https://adithya-rajendran.com";

const source = {
    profileUpdatedAt: "2026-10-01T23:13:24Z",
    posts: [
        // A migration's _updatedAt is not asked for: only what the post
        // records.
        { slug: "my-homelab", publishedAt: "2026-03-30" },
        {
            slug: "running-gui-apps",
            publishedAt: "2026-03-26",
            revisedAt: "2026-04-02",
            changes: ["2026-04-10", null],
        },
    ],
    projects: [{ slug: "homelab", updatedAt: "2026-09-29T05:36:13Z" }],
    tags: ["homelab"],
};

function lastmod(url: string) {
    return sitemapEntries(source)
        .find((entry) => entry.url === url)
        ?.lastModified?.toISOString();
}

describe("sitemapEntries", () => {
    it("dates a post by its publication, revision or changelog, never a document edit", () => {
        expect(lastmod(`${SITE}/blog/my-homelab`)).toBe(
            "2026-03-30T00:00:00.000Z",
        );
        expect(lastmod(`${SITE}/blog/running-gui-apps`)).toBe(
            "2026-04-10T00:00:00.000Z",
        );
    });

    it("dates /blog and the tag pages by the newest post, home by it or the profile", () => {
        expect(lastmod(`${SITE}/blog`)).toBe("2026-04-10T00:00:00.000Z");
        expect(lastmod(`${SITE}/blog/tags/homelab`)).toBe(
            "2026-04-10T00:00:00.000Z",
        );
        expect(lastmod(SITE)).toBe("2026-10-01T23:13:24.000Z");
    });

    it("dates a project by its last edit, its only date", () => {
        expect(lastmod(`${SITE}/portfolio/homelab`)).toBe(
            "2026-09-29T05:36:13.000Z",
        );
        expect(lastmod(`${SITE}/portfolio`)).toBe("2026-09-29T05:36:13.000Z");
    });

    it("falls back to the build's date where no content dates a page", () => {
        const entries = sitemapEntries({
            posts: [],
            projects: [],
            tags: [],
            buildDate: "2026-10-06T00:00:00Z",
        });
        expect(
            entries.find((entry) => entry.url === `${SITE}/blog`)?.lastModified,
        ).toEqual(new Date("2026-10-06T00:00:00Z"));
    });
});

describe("renderSitemapXml", () => {
    it("writes the sitemap protocol's urlset, a lastmod only where dated", () => {
        const xml = renderSitemapXml([
            {
                url: `${SITE}/blog`,
                lastModified: new Date("2026-04-10T00:00:00Z"),
                changeFrequency: "weekly",
                priority: 0.8,
            },
            { url: `${SITE}/about`, changeFrequency: "monthly", priority: 0.7 },
        ]);
        expect(xml).toBe(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url>
<loc>${SITE}/blog</loc>
<lastmod>2026-04-10T00:00:00.000Z</lastmod>
<changefreq>weekly</changefreq>
<priority>0.8</priority>
</url>
<url>
<loc>${SITE}/about</loc>
<changefreq>monthly</changefreq>
<priority>0.7</priority>
</url>
</urlset>
`);
    });
});
