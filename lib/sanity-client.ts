import { cacheLife, cacheTag } from "next/cache";
import { defineQuery } from "next-sanity";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { fixturesEnabled, resolveFixtureQuery } from "@/lib/fixtures";
import { client, isSanityConfigured } from "@/lib/sanity-config";

export type ContentBlock = {
    _key?: string;
    _type: string;
    [key: string]: unknown;
};

export type ContentBody = ContentBlock[];

export type SanityImageValue = {
    _type?: "image";
    asset?: { _ref?: string; _type?: "reference" };
    alt?: string | null;
    caption?: string | null;
    lqip?: string | null;
    dimensions?: { width?: number; height?: number } | null;
};

export type ExternalLink = {
    _key: string;
    _type?: "externalLink";
    label: string;
    url: string;
};

export type CuriosityItem = {
    _key: string;
    _type?: "curiosity";
    title: string;
    note?: string | null;
    url?: string | null;
};

export type TimelineEntry = {
    _key: string;
    _type?: "timelineEntry";
    kind: "work" | "education";
    title: string;
    organization: string;
    location?: string | null;
    startDate: string;
    endDate?: string | null;
    summary?: string | null;
    highlights?: string[] | null;
    skills?: string[] | null;
    logo?: SanityImageValue | null;
};

export type SkillGroup = {
    _key: string;
    _type?: "skillGroup";
    title: string;
    skills: string[];
};

export type CredentialListItem = {
    _key: string;
    _type?: "credential";
    title: string;
    issuer: string;
    issuedOn: string;
    lifetime: boolean;
    expiresOn?: string | null;
    credentialId?: string | null;
    verificationUrl?: string | null;
    badge?: SanityImageValue | null;
    lifecycleStatus: "active" | "lifetime" | "expired";
};

export type ProfileData = {
    _id: string;
    _updatedAt?: string;
    name: string;
    headline: string;
    introduction: string;
    bio: string;
    location?: string | null;
    portrait?: SanityImageValue | null;
    resumeUrl?: string | null;
    socialLinks?: ExternalLink[] | null;
    currentCuriosities?: CuriosityItem[] | null;
    curiositiesUpdatedAt?: string | null;
    timeline?: TimelineEntry[] | null;
    skillGroups?: SkillGroup[] | null;
    credentials?: CredentialListItem[] | null;
};

export type PostListItem = {
    _id: string;
    title: string;
    slug: string;
    description: string;
    publishedAt: string;
    tags?: string[] | null;
    cover?: SanityImageValue | null;
    wordCount: number;
};

export type PostWithBody = PostListItem & {
    body: ContentBody;
    _updatedAt?: string;
};

export type PostMeta = Omit<PostListItem, "_id"> & {
    _updatedAt?: string;
};

export type ProjectListItem = {
    _id: string;
    _updatedAt?: string;
    title: string;
    slug: string;
    summary: string;
    status: "active" | "completed" | "paused" | "archived";
    startDate?: string | null;
    endDate?: string | null;
    technologies?: string[] | null;
    highlights?: string[] | null;
    cover?: SanityImageValue | null;
    links?: ExternalLink[] | null;
};

export type ProjectWithBody = ProjectListItem & { body: ContentBody };

const imageMetadataProjection = `
    ...,
    "lqip": asset->metadata.lqip,
    "dimensions": asset->metadata.dimensions{width, height}
`;

const contentBodyProjection = `body[]{
    ...,
    _type == "image" => {${imageMetadataProjection}},
    _type == "gallery" => {
        ...,
        images[]{${imageMetadataProjection}}
    }
}`;

export const PROFILE_QUERY = defineQuery(`*[_id == "profile"][0]{
    _id,
    _updatedAt,
    name,
    headline,
    introduction,
    bio,
    location,
    portrait,
    "resumeUrl": resume.asset->url,
    socialLinks[]{_key, _type, label, url},
    currentCuriosities[]{_key, _type, title, note, url},
    curiositiesUpdatedAt,
    timeline[]{
        _key, _type, kind, title, organization, location, startDate, endDate,
        summary, highlights, skills, logo
    },
    skillGroups[]{_key, _type, title, skills},
    credentials[]{
        _key, _type, title, issuer, issuedOn, lifetime, expiresOn,
        credentialId, verificationUrl, badge,
        "lifecycleStatus": select(
            lifetime == true => "lifetime",
            defined(expiresOn) && expiresOn < $today => "expired",
            "active"
        )
    }
}`);

export const POST_LIST_QUERY = defineQuery(`*[
    _type == "post" && defined(publishedAt) && publishedAt <= $today
] | order(publishedAt desc){
    _id,
    title,
    "slug": slug.current,
    description,
    publishedAt,
    tags,
    cover,
    "wordCount": length(string::split(pt::text(body), " "))
}`);

export const RECENT_POSTS_QUERY = defineQuery(`*[
    _type == "post" && defined(publishedAt) && publishedAt <= $today
] | order(publishedAt desc){
    _id,
    _updatedAt,
    title,
    "slug": slug.current,
    description,
    publishedAt,
    tags,
    cover,
    "wordCount": length(string::split(pt::text(body), " ")),
    ${contentBodyProjection}
}`);

export const POST_BY_SLUG_QUERY = defineQuery(`*[
    _type == "post" && slug.current == $slug &&
    defined(publishedAt) && publishedAt <= $today
][0]{
    _id,
    _updatedAt,
    title,
    "slug": slug.current,
    description,
    publishedAt,
    tags,
    cover,
    "wordCount": length(string::split(pt::text(body), " ")),
    ${contentBodyProjection}
}`);

export const POST_META_QUERY = defineQuery(`*[
    _type == "post" && slug.current == $slug &&
    defined(publishedAt) && publishedAt <= $today
][0]{
    title,
    "slug": slug.current,
    description,
    publishedAt,
    tags,
    cover,
    _updatedAt,
    "wordCount": length(string::split(pt::text(body), " "))
}`);

export const POST_SLUGS_QUERY = defineQuery(`*[
    _type == "post" && defined(publishedAt) && publishedAt <= $today
].slug.current`);

export const POST_SLUGS_WITH_DATES_QUERY = defineQuery(`*[
    _type == "post" && defined(publishedAt) && publishedAt <= $today
]{"slug": slug.current, "updatedAt": _updatedAt}`);

export const PROJECT_LIST_QUERY = defineQuery(`*[
    _type == "project" && defined(slug.current)
] | order(coalesce(endDate, startDate, _createdAt) desc){
    _id,
    _updatedAt,
    title,
    "slug": slug.current,
    summary,
    status,
    startDate,
    endDate,
    technologies,
    highlights,
    cover,
    links[]{_key, _type, label, url}
}`);

export const PROJECT_BY_SLUG_QUERY = defineQuery(`*[
    _type == "project" && slug.current == $slug
][0]{
    _id,
    _updatedAt,
    title,
    "slug": slug.current,
    summary,
    status,
    startDate,
    endDate,
    technologies,
    highlights,
    cover,
    links[]{_key, _type, label, url},
    ${contentBodyProjection}
}`);

export const PROJECT_SLUGS_QUERY = defineQuery(
    `*[_type == "project" && defined(slug.current)].slug.current`,
);

export const PROJECT_SLUGS_WITH_DATES_QUERY = defineQuery(`*[
    _type == "project" && defined(slug.current)
]{"slug": slug.current, "updatedAt": _updatedAt}`);

async function sanityFetch<T>(
    query: string,
    params: Record<string, unknown>,
    tag: string,
    fallback: T,
): Promise<T> {
    "use cache";
    cacheLife({
        stale: 60 * 60,
        revalidate: 60 * 60 * 24,
        expire: 60 * 60 * 24 * 7,
    });
    cacheTag(tag);

    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const allParams = { now, today, ...params };

    if (!isSanityConfigured) {
        if (fixturesEnabled()) {
            const fixture = resolveFixtureQuery<T>(query, allParams);
            if (fixture !== null) return fixture;
        }
        return fallback;
    }

    try {
        const result = await client.fetch<T>(query, allParams);
        return result ?? fallback;
    } catch (error) {
        console.error(`[Sanity] Error fetching tag ${tag}:`, error);
        throw error;
    }
}

export function getProfile(): Promise<ProfileData | null> {
    return sanityFetch(PROFILE_QUERY, {}, CACHE_TAGS.profile, null);
}

export function getAllPosts(): Promise<PostListItem[]> {
    return sanityFetch(POST_LIST_QUERY, {}, CACHE_TAGS.post, []);
}

export async function getRecentPostsWithBody(
    limit = 20,
): Promise<PostWithBody[]> {
    const posts = await sanityFetch<PostWithBody[]>(
        RECENT_POSTS_QUERY,
        {},
        CACHE_TAGS.post,
        [],
    );
    const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit) || 1));
    return posts.slice(0, safeLimit);
}

export function getPostBySlug(slug: string): Promise<PostWithBody | null> {
    return sanityFetch(POST_BY_SLUG_QUERY, { slug }, CACHE_TAGS.post, null);
}

export function getPostMeta(slug: string): Promise<PostMeta | null> {
    return sanityFetch(POST_META_QUERY, { slug }, CACHE_TAGS.post, null);
}

export function getAllSlugs(): Promise<string[]> {
    return sanityFetch(POST_SLUGS_QUERY, {}, CACHE_TAGS.post, []);
}

export function getAllSlugsWithDates(): Promise<
    { slug: string; updatedAt: string }[]
> {
    return sanityFetch(POST_SLUGS_WITH_DATES_QUERY, {}, CACHE_TAGS.post, []);
}

export function getAllProjects(): Promise<ProjectListItem[]> {
    return sanityFetch(PROJECT_LIST_QUERY, {}, CACHE_TAGS.project, []);
}

export function getProjectBySlug(
    slug: string,
): Promise<ProjectWithBody | null> {
    return sanityFetch(
        PROJECT_BY_SLUG_QUERY,
        { slug },
        CACHE_TAGS.project,
        null,
    );
}

export function getAllProjectSlugs(): Promise<string[]> {
    return sanityFetch(PROJECT_SLUGS_QUERY, {}, CACHE_TAGS.project, []);
}

export function getAllProjectSlugsWithDates(): Promise<
    { slug: string; updatedAt: string }[]
> {
    return sanityFetch(
        PROJECT_SLUGS_WITH_DATES_QUERY,
        {},
        CACHE_TAGS.project,
        [],
    );
}
