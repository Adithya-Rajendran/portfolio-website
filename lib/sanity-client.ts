import { createClient } from "next-sanity";
import type {
    SanityPostType,
    SanityExperienceType,
    SanityProjectType,
    SanityCertificationType,
    SanitySkillCategoryType,
    SanityAboutType,
} from "./types";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const apiVersion = "2024-01-01";

if (!projectId) {
    console.warn("[Sanity] Missing NEXT_PUBLIC_SANITY_PROJECT_ID env var");
}

export const client = createClient({
    projectId: projectId || "fallback", // Ensure we have a string even if env var is missing during build
    dataset,
    apiVersion,
    useCdn: true,
});

const isSanityConfigured = Boolean(projectId && projectId !== "fallback");

// Blog posts revalidate every hour as a fallback alongside tag-based on-demand revalidation.
const postCacheOptions = { next: { tags: ["post"], revalidate: 3600 } };

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

// Fetch all published posts, sorted by date descending
export async function getAllPosts(): Promise<SanityPostType[]> {
    if (!isSanityConfigured) return [];
    try {
        const today = new Date().toISOString().split("T")[0];
        const posts = await client.fetch(
            `*[_type == "post" && date <= $today] | order(date desc) ${postProjection}`,
            { today },
            postCacheOptions,
        );
        return posts || [];
    } catch (error) {
        console.error("[Sanity] Error fetching all posts:", error);
        return [];
    }
}

// Fetch featured posts only
export async function getFeaturedPosts(): Promise<SanityPostType[]> {
    if (!isSanityConfigured) return [];
    try {
        const today = new Date().toISOString().split("T")[0];
        const posts = await client.fetch(
            `*[_type == "post" && featured == true && date <= $today] | order(date desc) ${postProjection}`,
            { today },
            postCacheOptions,
        );
        return posts || [];
    } catch (error) {
        console.error("[Sanity] Error fetching featured posts:", error);
        return [];
    }
}

// Fetch a single post by slug.
// Uses conditional revalidation: recent posts (< 7 days) revalidate hourly,
// older posts revalidate weekly. The date is fetched first with a lightweight
// query, then the full post is cached with the appropriate revalidation window.
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
export async function getPostBySlug(
    slug: string,
): Promise<SanityPostType | null> {
    if (!isSanityConfigured) return null;
    try {
        // Lightweight date lookup to determine cache duration
        const meta = await client.fetch(
            `*[_type == "post" && slug.current == $slug][0]{ date }`,
            { slug },
            { next: { tags: ["post"], revalidate: 3600 } },
        );
        if (!meta?.date) return null;

        const ageMs = Date.now() - new Date(meta.date).getTime();
        const revalidate = ageMs < SEVEN_DAYS_MS ? 3600 : 604800;

        const post = await client.fetch(
            `*[_type == "post" && slug.current == $slug][0] ${postProjection}`,
            { slug },
            { next: { tags: ["post"], revalidate } },
        );
        return post || null;
    } catch (error) {
        console.error("[Sanity] Error fetching post by slug:", error);
        return null;
    }
}

// Fetch all slugs and their last modified dates for sitemap generation
export async function getAllSlugsWithDates(): Promise<
    { slug: string; updatedAt: string }[]
> {
    if (!isSanityConfigured) return [];
    try {
        const today = new Date().toISOString().split("T")[0];
        const posts = await client.fetch(
            `*[_type == "post" && date <= $today] {
                "slug": slug.current,
                "updatedAt": _updatedAt
            }`,
            { today },
            postCacheOptions,
        );
        return posts || [];
    } catch (error) {
        console.error("[Sanity] Error fetching slugs and dates:", error);
        return [];
    }
}

// Fetch all slugs for static path generation
export async function getAllSlugs(): Promise<string[]> {
    if (!isSanityConfigured) return [];
    try {
        const today = new Date().toISOString().split("T")[0];
        const slugs = await client.fetch(
            `*[_type == "post" && date <= $today].slug.current`,
            { today },
            postCacheOptions
        );
        return slugs || [];
    } catch (error) {
        console.error("[Sanity] Error fetching slugs:", error);
        return [];
    }
}

// ---- Portfolio data fetchers ----

// Time-based revalidation as a fallback safety net alongside tag-based on-demand revalidation.
// Portfolio data changes rarely, so 24 hours is a good baseline.
const portfolioCacheOptions = { next: { tags: ["portfolio"], revalidate: 86400 } };

// Fetch the singleton About document
export async function getAbout(): Promise<SanityAboutType | null> {
    if (!isSanityConfigured) return null;
    try {
        const about = await client.fetch(
            `*[_type == "about"][0]{ _id, body }`,
            {},
            portfolioCacheOptions,
        );
        return about || null;
    } catch (error) {
        console.error("[Sanity] Error fetching about:", error);
        return null;
    }
}

// Fetch all experiences sorted by order
export async function getAllExperiences(): Promise<SanityExperienceType[]> {
    if (!isSanityConfigured) return [];
    try {
        const experiences = await client.fetch(
            `*[_type == "experience"] | order(order asc) {
                _id, title, org, location, description, icon, date, order
            }`,
            {},
            portfolioCacheOptions,
        );
        return experiences || [];
    } catch (error) {
        console.error("[Sanity] Error fetching experiences:", error);
        return [];
    }
}

// Fetch all projects sorted by order
export async function getAllProjects(): Promise<SanityProjectType[]> {
    if (!isSanityConfigured) return [];
    try {
        const projects = await client.fetch(
            `*[_type == "project"] | order(order asc) {
                _id, title, description, tags, image, linkTitle, linkUrl, order
            }`,
            {},
            portfolioCacheOptions,
        );
        return projects || [];
    } catch (error) {
        console.error("[Sanity] Error fetching projects:", error);
        return [];
    }
}

// Fetch all certifications sorted by order
export async function getAllCertifications(): Promise<SanityCertificationType[]> {
    if (!isSanityConfigured) return [];
    try {
        const certifications = await client.fetch(
            `*[_type == "certification"] | order(order asc) {
                _id, title, org, startDate, endDate, badge, verifyUrl, order
            }`,
            {},
            portfolioCacheOptions,
        );
        return certifications || [];
    } catch (error) {
        console.error("[Sanity] Error fetching certifications:", error);
        return [];
    }
}

// Fetch all skill categories sorted by order
export async function getAllSkillCategories(): Promise<SanitySkillCategoryType[]> {
    if (!isSanityConfigured) return [];
    try {
        const categories = await client.fetch(
            `*[_type == "skillCategory"] | order(order asc) {
                _id, title, "slug": slug.current, skills, colorVariant, order
            }`,
            {},
            portfolioCacheOptions,
        );
        return categories || [];
    } catch (error) {
        console.error("[Sanity] Error fetching skill categories:", error);
        return [];
    }
}
