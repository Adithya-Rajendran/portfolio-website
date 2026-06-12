/**
 * Cache tag taxonomy — the single place tag strings live. Producers
 * (cached fetchers) and the revalidation webhook must both import from
 * here so a tag can never be orphaned by a typo.
 *
 * Webhook contract (app/api/revalidate/route.ts): publishing a post
 * revalidates postList + post(slug); portfolio content revalidates
 * portfolio.
 */
export const CACHE_TAGS = {
    /** All blog listing surfaces (index cards, counts, sitemap). */
    postList: "post-list",
    /** A single post page, keyed by slug. */
    post: (slug: string) => `post:${slug}`,
    /** Portfolio content: intro, skills, experience, projects, certs. */
    portfolio: "portfolio",
} as const;
