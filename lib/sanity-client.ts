import { client, isSanityConfigured } from "./sanity-config";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "./cache-tags";
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
    "_id" | "body" | "subtitle" | "heroDescription" | "homeBio" | "available"
> & {
    resumeUrl?: string | null;
};

export { client } from "./sanity-config";

// Reusable GROQ projections
const postProjection = `{
    title,
    "slug": slug.current,
    description,
    date,
    featured,
    image,
    body
}`;

// Lightweight metadata-only projection — no body payload.
// Used by the blog hero so the title/date/description render before the
// full post body (+ shiki highlighting) finishes loading.
const metaProjection = `{
    title,
    "slug": slug.current,
    description,
    date,
    image
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
    if (!isSanityConfigured) return fallback;
    try {
        const today = new Date().toISOString().split("T")[0];
        const result = await client.fetch<T>(query, { today, ...params });
        return result || fallback;
    } catch (error) {
        console.error(`[Sanity] Error fetching (tag: ${tag}):`, error);
        return fallback;
    }
}

// Fetch all published posts, sorted by date descending
export async function getAllPosts(): Promise<Post[]> {
    return sanityFetch<Post[]>(
        `*[_type == "post" && date <= $today] | order(date desc) ${postProjection}`,
        {},
        CACHE_TAGS.postList,
        [],
    );
}

// Fetch a single post by slug.
export async function getPostBySlug(slug: string): Promise<Post | null> {
    return sanityFetch<Post | null>(
        `*[_type == "post" && slug.current == $slug][0] ${postProjection}`,
        { slug },
        CACHE_TAGS.post(slug),
        null,
    );
}

export async function getPostMeta(
    slug: string,
): Promise<Pick<
    Post,
    "title" | "slug" | "description" | "date" | "image"
> | null> {
    return sanityFetch<Pick<
        Post,
        "title" | "slug" | "description" | "date" | "image"
    > | null>(
        `*[_type == "post" && slug.current == $slug][0] ${metaProjection}`,
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
        `*[_type == "post" && date <= $today] {
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
        `*[_type == "post" && date <= $today].slug.current`,
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
        `*[_type == "intro"][0]{ _id, body, "resumeUrl": resume.asset->url, subtitle, heroDescription, homeBio, available }`,
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
