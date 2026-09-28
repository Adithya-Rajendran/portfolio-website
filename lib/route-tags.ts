/**
 * The route → cache-tag contract (IMPLEMENTATION.md §2.1): every public URL,
 * with the tags of the content it shows. After the webhook or the cron
 * revalidates a tag, `warm(tag)` in `actions/warmCache.ts` requests every
 * route listed under it, so readers get fresh pages instead of starting the
 * regeneration themselves.
 *
 * - Tags follow the redesign's route map, so a page may be listed under a
 *   tag a little before it shows that content (`/about` under post and
 *   project until the Crew File lands); that costs one request per warm.
 * - Every page also shows the profile in its header, footer and JSON-LD.
 *   That alone does not list it under `profile`: those pages refresh on
 *   their next visit instead of being crawled on every profile edit.
 * - A share image carries its page's tags, or none when it reads no content
 *   (the résumé's is fixed text). Inside the `(site)` group its URL has a
 *   stable hash suffix; `tests/lib/route-tags.test.ts` recomputes every path
 *   from its file, and fails for a route file missing here.
 * - A route that renders on every request (`perRequest`; it is not in the
 *   build's prerender manifest) keeps its tags as a record but is never
 *   warmed: there is no cached copy to refresh, so a warm request would only
 *   render it once for nobody.
 *
 * This module has no server-only imports, so the e2e smoke spec reads it.
 */
import { CACHE_TAGS, type CacheTag } from "@/lib/cache-tags";
import { TAG_PATTERN } from "@/lib/tags";

/** Where the values of a route's dynamic segment come from. */
export type RouteExpansion = "post" | "tag" | "project";

export type RouteTagEntry = {
    /** The public path; `[slug]` or `[tag]` stands for each published value. */
    readonly path: string;
    /** The file that serves it. */
    readonly file: string;
    /** The tags of the content it shows. Empty: never warmed. */
    readonly tags: readonly CacheTag[];
    readonly expand?: RouteExpansion;
    /** It answers with a redirect, which is warmed without following it. */
    readonly redirects?: true;
    /** It renders on every request, so it is never warmed. */
    readonly perRequest?: true;
};

const { profile, post, project } = CACHE_TAGS;

export const ROUTE_TAGS: readonly RouteTagEntry[] = [
    // Entry points first: warming requests the list in this order.
    { path: "/", file: "app/(site)/page.tsx", tags: [profile, post, project] },
    {
        path: "/blog",
        file: "app/(site)/blog/page.tsx",
        tags: [profile, post],
    },
    {
        path: "/blog/archive",
        file: "app/(site)/blog/archive/page.tsx",
        tags: [profile, post],
    },
    {
        path: "/portfolio",
        file: "app/(site)/portfolio/page.tsx",
        tags: [profile, project, post],
    },
    {
        path: "/resume",
        file: "app/(site)/resume/page.tsx",
        tags: [profile, project],
    },
    {
        path: "/about",
        file: "app/(site)/about/page.tsx",
        tags: [profile, post, project],
    },
    { path: "/contact", file: "app/(site)/contact/page.tsx", tags: [profile] },
    { path: "/feed.xml", file: "app/feed.xml/route.ts", tags: [post, profile] },
    {
        path: "/sitemap.xml",
        file: "app/sitemap.ts",
        tags: [profile, post, project],
    },

    // Share images: the same tags as their page.
    {
        path: "/opengraph-image-12o0cb",
        file: "app/(site)/opengraph-image.tsx",
        tags: [profile, post, project],
    },
    {
        path: "/blog/opengraph-image-14vkmf",
        file: "app/(site)/blog/opengraph-image.tsx",
        tags: [profile, post],
    },
    {
        path: "/blog/archive/opengraph-image-dfhyke",
        file: "app/(site)/blog/archive/opengraph-image.tsx",
        tags: [profile, post],
    },
    {
        path: "/portfolio/opengraph-image-98lokn",
        file: "app/(site)/portfolio/opengraph-image.tsx",
        tags: [profile, project, post],
    },
    // Fixed text: it reads no content, so it is never warmed.
    {
        path: "/resume/opengraph-image-1nyaml",
        file: "app/(site)/resume/opengraph-image.tsx",
        tags: [],
    },
    {
        path: "/about/opengraph-image-1ycygp",
        file: "app/(site)/about/opengraph-image.tsx",
        tags: [profile, post, project],
    },
    {
        path: "/contact/opengraph-image-upzrkl",
        file: "app/(site)/contact/opengraph-image.tsx",
        tags: [profile],
    },

    // One page per published post, tag and project.
    {
        path: "/blog/[slug]",
        file: "app/(site)/blog/[slug]/page.tsx",
        tags: [post, project, profile],
        expand: "post",
    },
    {
        // No static params of its own, so Next.js renders it per request.
        path: "/blog/[slug]/opengraph-image-fx5gi7",
        file: "app/(site)/blog/[slug]/opengraph-image.tsx",
        tags: [post, project, profile],
        expand: "post",
        perRequest: true,
    },
    {
        path: "/blog/tags/[tag]",
        file: "app/(site)/blog/tags/[tag]/page.tsx",
        tags: [post],
        expand: "tag",
    },
    {
        path: "/portfolio/[slug]",
        file: "app/(site)/portfolio/[slug]/page.tsx",
        tags: [project, post, profile],
        expand: "project",
    },

    // The résumé PDF links: redirects to the current file.
    {
        path: "/resume/view",
        file: "app/(site)/resume/view/route.ts",
        tags: [profile],
        redirects: true,
    },
    {
        path: "/resume/download",
        file: "app/(site)/resume/download/route.ts",
        tags: [profile],
        redirects: true,
    },

    // No content tags: never warmed.
    { path: "/robots.txt", file: "app/robots.ts", tags: [] },
    { path: "/icon.svg", file: "app/icon.svg", tags: [] },
    { path: "/apple-icon.png", file: "app/apple-icon.png", tags: [] },
    { path: "/favicon.ico", file: "app/favicon.ico", tags: [] },
    { path: "/api/revalidate", file: "app/api/revalidate/route.ts", tags: [] },
    {
        path: "/api/cron/publish-due",
        file: "app/api/cron/publish-due/route.ts",
        tags: [],
    },
    {
        path: "/studio/[[...tool]]",
        file: "app/studio/[[...tool]]/page.tsx",
        tags: [],
    },
];

/**
 * A post's share image at its built URL (`/blog/<slug>/opengraph-image-…`),
 * for metadata that names the image directly (the BlogPosting JSON-LD).
 */
export function postShareImagePath(slug: string): string {
    const route = ROUTE_TAGS.find(
        (entry) => entry.file === "app/(site)/blog/[slug]/opengraph-image.tsx",
    );
    return (route?.path ?? "/blog/[slug]/opengraph-image").replace(
        "[slug]",
        slug,
    );
}

/**
 * Only slugs of this shape are put into a URL. Sanity validates slugs, but
 * a misconfigured document must not make warming fetch arbitrary paths.
 */
export const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/;

/** The published values each dynamic segment expands to. */
export type WarmLists = Record<RouteExpansion, readonly string[]>;

export type WarmTarget = { path: string; redirects: boolean };

const SEGMENT = /\[[a-z]+\]/;

function expansionValues(
    expand: RouteExpansion,
    lists: WarmLists,
): readonly string[] {
    const pattern = expand === "tag" ? TAG_PATTERN : SAFE_SLUG;
    return lists[expand].filter((value) => pattern.test(value));
}

/**
 * The cached routes a tag's content appears on, in table order: the ones
 * warming requests. Routes rendered per request are left out.
 */
export function routesForTag(tag: CacheTag): RouteTagEntry[] {
    return ROUTE_TAGS.filter(
        (route) => route.tags.includes(tag) && !route.perRequest,
    );
}

/** A route's URLs, with its dynamic segment expanded from `lists`. */
export function expandRoute(route: RouteTagEntry, lists: WarmLists): string[] {
    return route.expand
        ? expansionValues(route.expand, lists).map((value) =>
              route.path.replace(SEGMENT, value),
          )
        : [route.path];
}

/**
 * Every path to request after `tag` is revalidated: its routes, with each
 * dynamic segment expanded to the published values in `lists`.
 */
export function warmPaths(tag: CacheTag, lists: WarmLists): WarmTarget[] {
    const targets = new Map<string, WarmTarget>();
    for (const route of routesForTag(tag)) {
        for (const path of expandRoute(route, lists)) {
            targets.set(path, { path, redirects: route.redirects === true });
        }
    }
    return [...targets.values()];
}
