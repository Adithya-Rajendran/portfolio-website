import { client, isSanityConfigured } from "./sanity-config";
import { cacheLife, cacheTag } from "next/cache";
import type {
    Post,
    Experience,
    Project,
    Certification,
    SkillCategory,
    About,
    Intro,
} from "../sanity.types";

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

// Fetch all published posts, sorted by date descending
export async function getAllPosts(): Promise<Post[]> {
    "use cache";
    cacheLife("hours");
    cacheTag("post");
    if (!isSanityConfigured) return [];
    try {
        const today = new Date().toISOString().split("T")[0];
        const posts = await client.fetch(
            `*[_type == "post" && date <= $today] | order(date desc) ${postProjection}`,
            { today },
        );
        return posts || [];
    } catch (error) {
        console.error("[Sanity] Error fetching all posts:", error);
        return [];
    }
}

// Fetch featured posts only
export async function getFeaturedPosts(): Promise<Post[]> {
    "use cache";
    cacheLife("hours");
    cacheTag("post");
    if (!isSanityConfigured) return [];
    try {
        const today = new Date().toISOString().split("T")[0];
        const posts = await client.fetch(
            `*[_type == "post" && featured == true && date <= $today] | order(date desc) ${postProjection}`,
            { today },
        );
        return posts || [];
    } catch (error) {
        console.error("[Sanity] Error fetching featured posts:", error);
        return [];
    }
}

// Fetch a single post by slug.
export async function getPostBySlug(
    slug: string,
): Promise<Post | null> {
    "use cache";
    cacheLife("weeks");
    cacheTag("post");
    if (!isSanityConfigured) return null;
    try {
        const post = await client.fetch(
            `*[_type == "post" && slug.current == $slug][0] ${postProjection}`,
            { slug },
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
    "use cache";
    cacheLife("hours");
    cacheTag("post");
    if (!isSanityConfigured) return [];
    try {
        const today = new Date().toISOString().split("T")[0];
        const posts = await client.fetch(
            `*[_type == "post" && date <= $today] {
                "slug": slug.current,
                "updatedAt": _updatedAt
            }`,
            { today },
        );
        return posts || [];
    } catch (error) {
        console.error("[Sanity] Error fetching slugs and dates:", error);
        return [];
    }
}

// Fetch all slugs for static path generation
export async function getAllSlugs(): Promise<string[]> {
    "use cache";
    cacheLife("hours");
    cacheTag("post");
    if (!isSanityConfigured) return [];
    try {
        const today = new Date().toISOString().split("T")[0];
        const slugs = await client.fetch(
            `*[_type == "post" && date <= $today].slug.current`,
            { today },
        );
        return slugs || [];
    } catch (error) {
        console.error("[Sanity] Error fetching slugs:", error);
        return [];
    }
}

// ---- Portfolio data fetchers ----

// Fetch the singleton About document
export async function getAbout(): Promise<About | null> {
    "use cache";
    cacheLife("days");
    cacheTag("portfolio");
    if (!isSanityConfigured) return null;
    try {
        const about = await client.fetch(
            `*[_type == "about"][0]{ _id, body }`,
            {},
        );
        return about || null;
    } catch (error) {
        console.error("[Sanity] Error fetching about:", error);
        return null;
    }
}

// Fetch the singleton Intro document
export async function getIntro(): Promise<Intro | null> {
    "use cache";
    cacheLife("days");
    cacheTag("portfolio");
    if (!isSanityConfigured) return null;
    try {
        const intro = await client.fetch(
            `*[_type == "intro"][0]{ _id, body, "resumeUrl": resume.asset->url, subtitle, homeBio }`,
            {},
        );
        return intro || null;
    } catch (error) {
        console.error("[Sanity] Error fetching intro:", error);
        return null;
    }
}

// Fetch all experiences sorted by order
export async function getAllExperiences(): Promise<Experience[]> {
    "use cache";
    cacheLife("days");
    cacheTag("portfolio");
    if (!isSanityConfigured) return [];
    try {
        const experiences = await client.fetch(
            `*[_type == "experience"] | order(order asc) {
                _id, title, org, location, description, icon, date, order
            }`,
            {},
        );
        return experiences || [];
    } catch (error) {
        console.error("[Sanity] Error fetching experiences:", error);
        return [];
    }
}

// Fetch all projects sorted by order
export async function getAllProjects(): Promise<Project[]> {
    "use cache";
    cacheLife("days");
    cacheTag("portfolio");
    if (!isSanityConfigured) return [];
    try {
        const projects = await client.fetch(
            `*[_type == "project"] | order(order asc) {
                _id, title, description, tags, image, linkTitle, linkUrl, order
            }`,
            {},
        );
        return projects || [];
    } catch (error) {
        console.error("[Sanity] Error fetching projects:", error);
        return [];
    }
}

// Fetch all certifications sorted by order
export async function getAllCertifications(): Promise<Certification[]> {
    "use cache";
    cacheLife("days");
    cacheTag("portfolio");
    if (!isSanityConfigured) return [];
    try {
        const certifications = await client.fetch(
            `*[_type == "certification"] | order(order asc) {
                _id, title, org, startDate, endDate, badge, verifyUrl, order
            }`,
            {},
        );
        return certifications || [];
    } catch (error) {
        console.error("[Sanity] Error fetching certifications:", error);
        return [];
    }
}

// Fetch all skill categories sorted by order
export async function getAllSkillCategories(): Promise<SkillCategory[]> {
    "use cache";
    cacheLife("days");
    cacheTag("portfolio");
    if (!isSanityConfigured) return [];
    try {
        const categories = await client.fetch(
            `*[_type == "skillCategory"] | order(order asc) {
                _id, title, "slug": slug.current, skills, colorVariant, order
            }`,
            {},
        );
        return categories || [];
    } catch (error) {
        console.error("[Sanity] Error fetching skill categories:", error);
        return [];
    }
}
