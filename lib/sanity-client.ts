import { createClient } from "next-sanity";
import type { SanityPostType } from "./types";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const apiVersion = "2024-01-01";

export const client = createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: true,
});

// Fetch all published posts, sorted by date descending
export async function getAllPosts(): Promise<SanityPostType[]> {
    return client.fetch(
        `*[_type == "post" && date <= now()] | order(date desc) {
            title,
            "slug": slug.current,
            description,
            date,
            featured,
            image,
            body
        }`
    );
}

// Fetch featured posts only
export async function getFeaturedPosts(): Promise<SanityPostType[]> {
    return client.fetch(
        `*[_type == "post" && featured == true && date <= now()] | order(date desc) {
            title,
            "slug": slug.current,
            description,
            date,
            featured,
            image,
            body
        }`
    );
}

// Fetch a single post by slug
export async function getPostBySlug(
    slug: string
): Promise<SanityPostType | null> {
    return client.fetch(
        `*[_type == "post" && slug.current == $slug][0] {
            title,
            "slug": slug.current,
            description,
            date,
            featured,
            image,
            body
        }`,
        { slug }
    );
}

// Fetch all slugs for static generation
export async function getAllSlugs(): Promise<string[]> {
    return client.fetch(
        `*[_type == "post" && date <= now()].slug.current`
    );
}
