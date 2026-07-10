import { client, isSanityConfigured } from "./sanity-config";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "./cache-tags";
import { fixturesEnabled, resolveFixtureQuery } from "./fixtures";
import type {
    Post,
    Experience,
    Project,
    Certification,
    SkillCategory,
    About,
    Intro,
} from "../sanity.types";

export type IntroData = Pick<
    Intro,
    | "_id"
    | "body"
    | "subtitle"
    | "heroDescription"
    | "homeBio"
    | "available"
    | "role"
    | "affiliation"
    | "knowsAbout"
    | "education"
> & {
    resumeUrl?: string | null;
};

/** List-shaped post: what the index cards/counters actually consume.
 *  No body — reading time ships as a precomputed word count. */
export type PostListItem = Pick<
    Post,
    "_id" | "title" | "description" | "date" | "featured" | "image" | "tags"
> & { slug: string; wordCount: number };

export type PostWithBody = Pick<
    Post,
    "_id" | "title" | "description" | "date" | "body"
> & { slug: string };

// Full post — only the single-post page needs the body. Body images get
// the asset's LQIP + intrinsic dimensions joined in (blur-up placeholder
// and CLS-free sizing in the renderer).
const postProjection = `{
    _id,
    title,
    "slug": slug.current,
    description,
    date,
    featured,
    tags,
    image,
    body[]{
        ...,
        _type == "image" => {
            ...,
            "lqip": asset->metadata.lqip,
            "dimensions": asset->metadata.dimensions{ width, height }
        }
    }
}`;

// List projection — everything the cards need, body replaced by a
// server-computed word count so list payloads stay small.
const postListProjection = `{
    _id,
    title,
    "slug": slug.current,
    description,
    date,
    featured,
    tags,
    image,
    "wordCount": length(string::split(pt::text(body), " "))
}`;

// Lightweight metadata-only projection — no body payload.
// Used by the blog hero so the title/date/description render before the
// full post body (+ shiki highlighting) finishes loading.
// _updatedAt + wordCount feed BlogPosting structured data
// (dateModified/wordCount) — still body-free.
const metaProjection = `{
    title,
    "slug": slug.current,
    description,
    date,
    tags,
    image,
    _updatedAt,
    "wordCount": length(string::split(pt::text(body), " "))
}`;

/**
 * Single cached Sanity fetcher behind every typed wrapper below. The
 * (query, params, tag, fallback) arguments form the cache key, so one
 * "use cache" function safely serves every content type.
 *
 * $today is computed inside the cache scope (new Date() is illegal in an
 * uncached prerender under cacheComponents) and merged into every request;
 * the GROQ API ignores params a query doesn't reference.
 */
async function sanityFetch<T>(
    query: string,
    params: Record<string, unknown>,
    tag: string,
    fallback: T,
): Promise<T> {
    "use cache";
    cacheLife("max");
    cacheTag(tag);
    if (!isSanityConfigured) {
        // Dev-only: serve realistic sample content when explicitly asked
        // (SANITY_USE_FIXTURES=1). Unreachable whenever Sanity is
        // configured, so production can never serve fixtures.
        if (fixturesEnabled()) {
            const fixture = resolveFixtureQuery<T>(query, params);
            if (fixture !== null) return fixture;
        }
        return fallback;
    }
    try {
        const today = new Date().toISOString().split("T")[0];
        const result = await client.fetch<T>(query, { today, ...params });
        return result || fallback;
    } catch (error) {
        console.error(`[Sanity] Error fetching (tag: ${tag}):`, error);
        return fallback;
    }
}

/**
 * The single definition of "published" — this predicate gates the blog
 * index, feed, sitemap, tag/archive pages, generateStaticParams, AND the
 * single-post fetches, so they can never disagree about visibility.
 * `extra` is inserted before the date gate so the slug-scoped variants
 * stay byte-identical to the historical query strings (sanityFetch cache
 * keys derive from the literal query text).
 */
const publishedPost = (extra = "") =>
    `_type == "post"${extra} && date <= $today`;

// Fetch all published posts (list shape, no bodies), newest first
export async function getAllPosts(): Promise<PostListItem[]> {
    return sanityFetch<PostListItem[]>(
        `*[${publishedPost()}] | order(date desc) ${postListProjection}`,
        {},
        CACHE_TAGS.postList,
        [],
    );
}

// Newest posts including bodies — feeds the RSS renderer. Tagged with
// the list tag: the webhook revalidates post-list on every post change,
// so body edits refresh the feed without new webhook wiring.
export async function getRecentPostsWithBody(
    limit = 20,
): Promise<PostWithBody[]> {
    // GROQ slice bounds must be literal constants — `[0...$limit]` is a
    // parse error the API rejects (and sanityFetch would swallow into a
    // permanently empty feed). Clamp and interpolate instead; limit is
    // an internal integer, never user input.
    const bound = Math.min(100, Math.max(1, Math.trunc(limit) || 1));
    return sanityFetch<PostWithBody[]>(
        `*[${publishedPost()}] | order(date desc) [0...${bound}] {
                _id,
                title,
                "slug": slug.current,
                description,
                date,
                body
            }`,
        {},
        CACHE_TAGS.postList,
        [],
    );
}

// Fetch a single published post by slug. The date filter matches the
// listing queries so future-dated posts are not reachable by URL early.
export async function getPostBySlug(slug: string): Promise<Post | null> {
    return sanityFetch<Post | null>(
        `*[${publishedPost(" && slug.current == $slug")}][0] ${postProjection}`,
        { slug },
        CACHE_TAGS.post(slug),
        null,
    );
}

export type PostMeta = Pick<
    Post,
    "title" | "slug" | "description" | "date" | "tags" | "image" | "_updatedAt"
> & { wordCount?: number };

export async function getPostMeta(slug: string): Promise<PostMeta | null> {
    return sanityFetch<PostMeta | null>(
        `*[${publishedPost(" && slug.current == $slug")}][0] ${metaProjection}`,
        { slug },
        CACHE_TAGS.post(slug),
        null,
    );
}

// Fetch all slugs and their last modified dates for sitemap generation
export async function getAllSlugsWithDates(): Promise<
    { slug: string; updatedAt: string }[]
> {
    return sanityFetch<{ slug: string; updatedAt: string }[]>(
        `*[${publishedPost()}] {
                "slug": slug.current,
                "updatedAt": _updatedAt
            }`,
        {},
        CACHE_TAGS.postList,
        [],
    );
}

// Fetch all slugs for static path generation
export async function getAllSlugs(): Promise<string[]> {
    return sanityFetch<string[]>(
        `*[${publishedPost()}].slug.current`,
        {},
        CACHE_TAGS.postList,
        [],
    );
}

// ---- Portfolio data fetchers ----

// Fetch the singleton About document
export async function getAbout(): Promise<About | null> {
    return sanityFetch<About | null>(
        `*[_type == "about"][0]{ _id, body }`,
        {},
        CACHE_TAGS.portfolio,
        null,
    );
}

// Fetch the singleton Intro document
export async function getIntro(): Promise<IntroData | null> {
    return sanityFetch<IntroData | null>(
        `*[_type == "intro"][0]{ _id, body, "resumeUrl": resume.asset->url, subtitle, heroDescription, homeBio, available, role, affiliation, knowsAbout, education }`,
        {},
        CACHE_TAGS.portfolio,
        null,
    );
}

// Fetch all experiences sorted by order
export async function getAllExperiences(): Promise<Experience[]> {
    return sanityFetch<Experience[]>(
        `*[_type == "experience"] | order(order asc) {
                _id, title, org, location, description, icon, date, order
            }`,
        {},
        CACHE_TAGS.portfolio,
        [],
    );
}

// Fetch all projects sorted by order
export async function getAllProjects(): Promise<Project[]> {
    return sanityFetch<Project[]>(
        `*[_type == "project"] | order(order asc) {
                _id, title, description, tags, image, linkTitle, linkUrl, order
            }`,
        {},
        CACHE_TAGS.portfolio,
        [],
    );
}

// Fetch all certifications sorted by order
export async function getAllCertifications(): Promise<Certification[]> {
    return sanityFetch<Certification[]>(
        `*[_type == "certification"] | order(order asc) {
                _id, title, org, startDate, endDate, badge, verifyUrl, order
            }`,
        {},
        CACHE_TAGS.portfolio,
        [],
    );
}

// Fetch all skill categories sorted by order
export async function getAllSkillCategories(): Promise<SkillCategory[]> {
    return sanityFetch<SkillCategory[]>(
        `*[_type == "skillCategory"] | order(order asc) {
                _id, title, "slug": slug.current, skills, colorVariant, order
            }`,
        {},
        CACHE_TAGS.portfolio,
        [],
    );
}
