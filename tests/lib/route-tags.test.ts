import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
    normalizeMetadataPageToRoute,
    normalizeMetadataRoute,
} from "next/dist/lib/metadata/get-metadata-route";
import { normalizeAppPath } from "next/dist/shared/lib/router/utils/app-paths";
import {
    ROUTE_TAGS,
    routesForTag,
    warmPaths,
    type WarmLists,
} from "@/lib/route-tags";

/** Files under app/ that answer a URL: pages, route handlers, metadata. */
const ROUTE_FILE =
    /^(page|route)\.[jt]sx?$|^(opengraph-image|twitter-image|icon|apple-icon|sitemap|robots|manifest)(\.|$)|^favicon\.ico$/;

function routeFiles(dir = "app"): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return routeFiles(path);
        return ROUTE_FILE.test(entry.name) ? [path] : [];
    });
}

/**
 * The URL Next.js serves a file at, from Next's own helpers: route groups
 * vanish, metadata routes gain their extension and, inside a group, a
 * stable hash suffix. Code files drop their extension; static files keep it.
 */
function builtPath(file: string): string {
    const page = `/${file.replace(/^app\//, "").replace(/\.[jt]sx?$/, "")}`;
    const route = normalizeMetadataPageToRoute(
        normalizeMetadataRoute(page),
        false,
    );
    return normalizeAppPath(route.replace(/\/route$/, "")) || "/";
}

const LISTS: WarmLists = {
    post: ["post-a", "post-b"],
    tag: ["robotics"],
    project: ["homelab"],
};

describe("route table", () => {
    it("lists every route file in app/ exactly once", () => {
        const files = ROUTE_TAGS.map((route) => route.file);
        expect(new Set(files).size).toBe(files.length);
        // A new page, handler or share image fails here until its route
        // and tags are added to lib/route-tags.ts.
        expect([...files].sort()).toEqual(routeFiles().sort());
    });

    it("uses the URL Next.js builds for each file", () => {
        for (const route of ROUTE_TAGS) {
            expect(existsSync(route.file), route.file).toBe(true);
            expect(builtPath(route.file), route.file).toBe(route.path);
        }
    });

    it("expands every tagged dynamic route from a published list", () => {
        for (const route of ROUTE_TAGS) {
            const dynamic = /\[[a-z]+\]/.test(route.path);
            if (route.tags.length) {
                expect(Boolean(route.expand), route.path).toBe(dynamic);
            }
        }
        expect(
            ROUTE_TAGS.filter((route) => route.expand).map((route) => [
                route.path,
                route.expand,
            ]),
        ).toEqual([
            ["/blog/[slug]", "post"],
            ["/blog/[slug]/opengraph-image-fx5gi7", "post"],
            ["/blog/tags/[tag]", "tag"],
            ["/portfolio/[slug]", "project"],
            ["/portfolio/[slug]/opengraph-image-ysfoa1", "project"],
        ]);
    });

    it("gives each share image the tags of its page, or none when it reads no content", () => {
        // Content reaches a share image through the Sanity client, directly
        // or through lib/og-template.tsx's makeIntroOgImage.
        const readsContent = (file: string) =>
            /@\/lib\/sanity-client|makeIntroOgImage/.test(
                readFileSync(file, "utf8"),
            );
        for (const image of ROUTE_TAGS.filter((route) =>
            route.file.endsWith("/opengraph-image.tsx"),
        )) {
            const page = ROUTE_TAGS.find(
                (route) =>
                    route.file ===
                    image.file.replace(/opengraph-image\.tsx$/, "page.tsx"),
            );
            expect(page, image.file).toBeDefined();
            expect([...image.tags].sort(), image.path).toEqual(
                readsContent(image.file) ? [...(page?.tags ?? [])].sort() : [],
            );
        }
    });

    it("never warms a route rendered on every request", () => {
        // Not in the build's prerender manifest (`next build` marks it ƒ):
        // a warm request would render it once for nobody.
        expect(
            ROUTE_TAGS.filter((route) => route.perRequest).map(
                (route) => route.path,
            ),
        ).toEqual([
            "/blog/[slug]/opengraph-image-fx5gi7",
            "/portfolio/[slug]/opengraph-image-ysfoa1",
        ]);
        const warmed = (["profile", "post", "project"] as const).flatMap(
            (tag) => warmPaths(tag, LISTS).map(({ path }) => path),
        );
        expect(
            warmed.some((path) =>
                /\/opengraph-image-(fx5gi7|ysfoa1)/.test(path),
            ),
        ).toBe(false);
    });

    it("never warms icons, robots, the API or the Studio", () => {
        const warmed = new Set(
            (["profile", "post", "project"] as const).flatMap((tag) =>
                routesForTag(tag).map((route) => route.path),
            ),
        );
        for (const path of [
            "/robots.txt",
            "/icon.svg",
            "/apple-icon.png",
            "/favicon.ico",
            "/api/revalidate",
            "/api/cron/publish-due",
            "/studio/[[...tool]]",
        ]) {
            expect(warmed.has(path), path).toBe(false);
        }
    });
});

describe("warm lists", () => {
    const paths = (tag: "profile" | "post" | "project", lists = LISTS) =>
        warmPaths(tag, lists).map(({ path }) => path);

    it("warms every page that shows posts after a post changes", () => {
        expect(paths("post")).toEqual([
            "/",
            "/blog",
            "/blog/archive",
            "/portfolio",
            "/resume",
            "/about",
            "/feed.xml",
            "/sitemap.xml",
            "/opengraph-image-12o0cb",
            "/blog/opengraph-image-14vkmf",
            "/blog/archive/opengraph-image-dfhyke",
            "/portfolio/opengraph-image-98lokn",
            "/resume/opengraph-image-1nyaml",
            "/about/opengraph-image-1ycygp",
            "/blog/post-a",
            "/blog/post-b",
            "/blog/tags/robotics",
            "/portfolio/homelab",
        ]);
    });

    it("warms mission pages, the lists that show them and linking posts after a project changes", () => {
        expect(paths("project")).toEqual([
            "/",
            "/portfolio",
            "/resume",
            "/about",
            "/sitemap.xml",
            "/opengraph-image-12o0cb",
            "/portfolio/opengraph-image-98lokn",
            "/resume/opengraph-image-1nyaml",
            "/about/opengraph-image-1ycygp",
            "/blog/post-a",
            "/blog/post-b",
            "/portfolio/homelab",
        ]);
    });

    it("warms identity pages, share images and the CV links after the profile changes", () => {
        expect(paths("profile")).toEqual([
            "/",
            "/blog",
            "/blog/archive",
            "/portfolio",
            "/resume",
            "/about",
            "/contact",
            "/feed.xml",
            "/sitemap.xml",
            "/opengraph-image-12o0cb",
            "/blog/opengraph-image-14vkmf",
            "/blog/archive/opengraph-image-dfhyke",
            "/portfolio/opengraph-image-98lokn",
            "/resume/opengraph-image-1nyaml",
            "/about/opengraph-image-1ycygp",
            "/contact/opengraph-image-upzrkl",
            "/blog/post-a",
            "/blog/post-b",
            "/portfolio/homelab",
            "/resume/view",
            "/resume/download",
        ]);
        expect(
            warmPaths("profile", LISTS).filter(({ redirects }) => redirects),
        ).toEqual([
            { path: "/resume/view", redirects: true },
            { path: "/resume/download", redirects: true },
        ]);
    });

    it("keeps the entry points when there is no content", () => {
        const empty = { post: [], tag: [], project: [] };
        expect(paths("post", empty)).toEqual(
            expect.arrayContaining([
                "/",
                "/blog",
                "/blog/archive",
                "/feed.xml",
            ]),
        );
        expect(paths("post", empty).some((path) => path.includes("["))).toBe(
            false,
        );
    });

    it("drops slugs and tags that are not URL-safe", () => {
        const warmed = paths("post", {
            post: ["../../api/revalidate", "ok-post", "Upper"],
            tag: ["../admin", "a b", "fine-tag"],
            project: ["/studio", "ok-project"],
        });
        expect(warmed).toContain("/blog/ok-post");
        expect(warmed).toContain("/blog/tags/fine-tag");
        expect(warmed).toContain("/portfolio/ok-project");
        expect(
            warmed.some(
                (path) =>
                    path.includes("..") ||
                    path.includes(" ") ||
                    path.includes("Upper") ||
                    path.includes("/studio"),
            ),
        ).toBe(false);
    });
});

describe("share-image redirects", () => {
    it("send every pre-route-group share image URL to its built URL", async () => {
        const { default: config } = await import("@/next.config.mjs");
        const redirects = (await config.redirects?.()) ?? [];
        const moved = redirects.filter(({ source }) =>
            source.endsWith("/opengraph-image"),
        );
        const images = ROUTE_TAGS.filter((route) =>
            route.file.endsWith("/opengraph-image.tsx"),
        );
        // One redirect per share image, to the path the build serves.
        expect(moved.map(({ destination }) => destination).sort()).toEqual(
            images.map((route) => route.path.replace("[slug]", ":slug")).sort(),
        );
        for (const redirect of moved) {
            expect(redirect.permanent, redirect.source).toBe(true);
            expect(redirect.destination, redirect.source).toBe(
                `${redirect.source}-${redirect.destination.split("-").pop()}`,
            );
        }
        // The archive's own image is not caught by the post pattern.
        const archive = moved.findIndex(
            ({ source }) => source === "/blog/archive/opengraph-image",
        );
        const post = moved.findIndex(
            ({ source }) => source === "/blog/:slug/opengraph-image",
        );
        expect(archive).toBeLessThan(post);
    });
});
