import { createClient } from "next-sanity";
import type { SanityPostType } from "./types";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const apiVersion = "2024-01-01";

if (!projectId) {
    console.warn("[Sanity] Missing NEXT_PUBLIC_SANITY_PROJECT_ID env var");
}

export const client = createClient({
    projectId: projectId || "",
    dataset,
    apiVersion,
    // Disable CDN so revalidation fetches hit the origin API with fresh data
    useCdn: false,
});

const isSanityConfigured = Boolean(projectId);

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
            { next: { tags: ["post"] } },
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
            { next: { tags: ["post"] } },
        );
        return posts || [];
    } catch (error) {
        console.error("[Sanity] Error fetching featured posts:", error);
        return [];
    }
}

// Fetch a single post by slug
export async function getPostBySlug(
    slug: string,
): Promise<SanityPostType | null> {
    if (!isSanityConfigured) return null;
    try {
        const post = await client.fetch(
            `*[_type == "post" && slug.current == $slug][0] ${postProjection}`,
            { slug },
            { next: { tags: ["post"] } },
        );
        return post || null;
    } catch (error) {
        console.error("[Sanity] Error fetching post by slug:", error);
        return null;
    }
}

// Fetch all slugs for static generation
export async function getAllSlugs(): Promise<string[]> {
    if (!isSanityConfigured) return [];
    try {
        const today = new Date().toISOString().split("T")[0];
        const slugs = await client.fetch(
            `*[_type == "post" && date <= $today].slug.current`,
            { today },
            { next: { tags: ["post"] } },
        );
        return slugs || [];
    } catch (error) {
        console.error("[Sanity] Error fetching slugs:", error);
        return [];
    }
}
