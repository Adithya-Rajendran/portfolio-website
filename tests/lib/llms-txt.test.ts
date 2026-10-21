import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { siteConfig } from "@/lib/config";
import { expandRoute, ROUTE_TAGS } from "@/lib/route-tags";
import { sitemapEntries } from "@/lib/sitemap";

/**
 * public/llms.txt, the llms.txt convention (llmstxt.org): the name as the
 * one H1, a one-paragraph blockquote, then H2 sections of links. It is
 * written by hand from the pages' own descriptions; the smoke spec checks
 * its posts and projects against the live sitemap.
 */
const TEXT = readFileSync("public/llms.txt", "utf8");

const LINK = /^- \[([^\]]+)\]\(([^)]+)\): (\S.*)$/;

/** Each H2 section's links, in order. */
function sections(): Map<string, { title: string; url: string }[]> {
    const map = new Map<string, { title: string; url: string }[]>();
    let current: { title: string; url: string }[] | undefined;
    for (const line of TEXT.split("\n")) {
        const heading = /^## (.+)$/.exec(line);
        if (heading) {
            current = [];
            map.set(heading[1], current);
            continue;
        }
        const link = LINK.exec(line);
        if (link && current) current.push({ title: link[1], url: link[2] });
    }
    return map;
}

const paths = (section: string) =>
    (sections().get(section) ?? []).map(({ url }) => new URL(url).pathname);

describe("llms.txt", () => {
    it("stays under 2 KB", () => {
        expect(Buffer.byteLength(TEXT, "utf8")).toBeLessThan(2048);
    });

    it("opens with the name and a one-paragraph summary", () => {
        const [title, blank, summary, after] = TEXT.split("\n");
        expect(title).toBe(`# ${siteConfig.author}`);
        expect(blank).toBe("");
        expect(summary).toMatch(/^> \S.+\.$/);
        expect(after).toBe("");
        expect(TEXT.match(/^# /gm)).toHaveLength(1);
    });

    it("has Writing, Projects, Profile and Policies, every line under them a described link", () => {
        expect([...sections().keys()]).toEqual([
            "Writing",
            "Projects",
            "Profile",
            "Policies",
        ]);
        const body = TEXT.slice(TEXT.indexOf("\n## "));
        for (const line of body.split("\n")) {
            if (line === "" || line.startsWith("## ")) continue;
            expect(line).toMatch(LINK);
        }
    });

    it("links by absolute URL, each under one of the site's routes", () => {
        const writing = paths("Writing");
        const projects = paths("Projects");
        expect(writing).toHaveLength(4);
        expect(projects).toHaveLength(3);
        const served = new Set(
            ROUTE_TAGS.flatMap((route) =>
                expandRoute(route, {
                    post: writing.map((path) => path.split("/").pop()!),
                    tag: [],
                    project: projects.map((path) => path.split("/").pop()!),
                }),
            ),
        );
        for (const { url } of [...sections().values()].flat()) {
            expect(url.startsWith(`${siteConfig.url}/`), url).toBe(true);
            expect(served.has(new URL(url).pathname), url).toBe(true);
        }
        for (const path of writing) expect(path).toMatch(/^\/blog\/[^/]+$/);
        for (const path of projects) {
            expect(path).toMatch(/^\/portfolio\/[^/]+$/);
        }
        expect(paths("Profile")).toEqual(["/about", "/resume", "/contact"]);
        expect(paths("Policies")).toEqual(["/robots.txt", "/feed.xml"]);
    });

    it("names no email address or phone number", () => {
        expect(TEXT).not.toMatch(/@|mailto:|tel:/);
        expect(TEXT).not.toMatch(/\+?\d[\d ().-]{8,}\d/);
    });

    it("is not a sitemap entry", () => {
        const urls = sitemapEntries({ posts: [], projects: [], tags: [] }).map(
            ({ url }) => url,
        );
        expect(urls.some((url) => url.endsWith("/llms.txt"))).toBe(false);
    });
});
