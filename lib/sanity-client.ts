import { cacheLife, cacheTag } from "next/cache";
import { defineQuery } from "next-sanity";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { fixturesEnabled, resolveFixtureQuery } from "@/lib/fixtures";
import type {
    AvailabilityStatus,
    CuriosityKind,
    DatePrecision,
    EmploymentType,
    LinkKind,
    TalkKind,
    TimelineDatePrecision,
} from "@/lib/profile-fields";
import type { ChangeKind } from "@/lib/post-fields";
import type {
    ImageKind,
    ModelKind,
    ProjectStatus,
    ProjectType,
    RealWorldDimension,
    RealWorldUnit,
} from "@/lib/project-fields";
import { client, isSanityConfigured } from "@/lib/sanity-config";
import type { ModelPartKey, ProceduralModelKey } from "@/lib/viewer/registry";
import type { WARM_LISTS_QUERY_RESULT } from "@/sanity.types";

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
    kind?: LinkKind | null;
};

export type CuriosityItem = {
    _key: string;
    _type?: "curiosity";
    /** Missing on items saved before kinds existed: treat as a question. */
    kind?: CuriosityKind | null;
    title: string;
    note?: string | null;
    url?: string | null;
    projectId?: string | null;
    postId?: string | null;
};

export type TimelineEntry = {
    _key: string;
    _type?: "timelineEntry";
    kind: "work" | "education";
    title: string;
    organization: string;
    orgShort?: string | null;
    orgUrl?: string | null;
    employment?: EmploymentType | null;
    location?: string | null;
    startDate?: string | null;
    /** `year`: only the year of `startDate` is known; never print a month. */
    startPrecision?: TimelineDatePrecision | null;
    endDate?: string | null;
    /** `year`: only the year of `endDate` is known; never print a month. */
    endPrecision?: TimelineDatePrecision | null;
    isCurrent?: boolean | null;
    expectedEndYear?: number | null;
    summary?: string | null;
    highlights?: string[] | null;
    skills?: string[] | null;
    logo?: SanityImageValue | null;
    burn?: { label: string; note?: string | null } | null;
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

/** One line of what the owner is open to: "Summer 2027 internships". */
export type Opening = {
    _key: string;
    label: string;
};

export type Availability = {
    status: AvailabilityStatus;
    /** One line per opening, printed as written and joined with " · ". */
    seeking?: Opening[] | null;
    /** The older single line; shown only while `seeking` is empty. */
    openTo?: string | null;
    /** The button that answers the Open To lines ("Write about a role"). */
    cta?: string | null;
    consultingOpen?: boolean | null;
    /** For the owner's records; never printed. */
    updatedAt?: string | null;
};

export type Launch = {
    date: string;
    /** Missing means an exact date; `year` means print the year alone. */
    precision?: DatePrecision | null;
    event: string;
};

/** The words of one contact route (Profile → Site copy). */
export type ContactRouteCopy = {
    title?: string | null;
    prompt?: string | null;
};

export type ContactRoutesCopy = {
    hiring?: ContactRouteCopy | null;
    research?: ContactRouteCopy | null;
    consulting?: ContactRouteCopy | null;
    hello?: ContactRouteCopy | null;
};

export type TalkOrPaper = {
    _key: string;
    _type?: "talkOrPaper";
    title: string;
    kind: TalkKind;
    venue?: string | null;
    date?: string | null;
    authors?: string | null;
    links?: ExternalLink[] | null;
    abstract?: string | null;
    projectId?: string | null;
};

export type ProfileData = {
    _id: string;
    _createdAt?: string;
    _updatedAt?: string;
    name: string;
    headline: string;
    tagline?: string | null;
    introduction: string;
    bio: string;
    availability?: Availability | null;
    launch?: Launch | null;
    focusAreas?: string[] | null;
    workSummary?: string | null;
    writingDescription?: string | null;
    contactInvitation?: string | null;
    /** The /portfolio introduction. */
    projectsIntro?: string | null;
    /** The /contact introduction. */
    contactIntro?: string | null;
    contactRoutes?: ContactRoutesCopy | null;
    seoDescription?: string | null;
    featuredPostId?: string | null;
    startHereIds?: string[] | null;
    location?: string | null;
    portrait?: SanityImageValue | null;
    resumeUrl?: string | null;
    /** When the résumé PDF was uploaded: the CV's revision. */
    resumeUploadedAt?: string | null;
    resumeNote?: string | null;
    socialLinks?: ExternalLink[] | null;
    currentCuriosities?: CuriosityItem[] | null;
    curiositiesUpdatedAt?: string | null;
    timeline?: TimelineEntry[] | null;
    skillGroups?: SkillGroup[] | null;
    credentials?: CredentialListItem[] | null;
    talksAndPapers?: TalkOrPaper[] | null;
};

/** A post's cover: image metadata plus its dominant colour (`bg`). */
export type PostCover = SanityImageValue & {
    credit?: string | null;
    kind?: ImageKind | null;
    bg?: string | null;
};

export type PostListItem = {
    _id: string;
    title: string;
    slug: string;
    description: string;
    publishedAt: string;
    /** The last substantive revision; never before `publishedAt`. */
    revisedAt?: string | null;
    tags?: string[] | null;
    /** Related projects, as ids: join against the project list. */
    projectIds?: string[] | null;
    cover?: PostCover | null;
    wordCount: number;
};

/** A dated update or correction to a post (G7 errata). */
export type PostChange = {
    _key: string;
    date: string;
    kind: ChangeKind;
    note: string;
};

export type PostWithBody = PostListItem & {
    body: ContentBody;
    _updatedAt?: string;
    /** Dated updates and corrections, oldest first as authored. */
    changelog?: PostChange[] | null;
};

export type PostMeta = Omit<PostListItem, "_id"> & {
    _updatedAt?: string;
};

export type ProjectParameter = {
    _key: string;
    label: string;
    value: string;
};

export type ProjectListItem = {
    _id: string;
    _updatedAt?: string;
    /** The mission number: 2 prints as MSN-02. */
    designation: number;
    title: string;
    /** The optional short name set in capitals ("Homelab"). */
    name?: string | null;
    slug: string;
    summary: string;
    status: ProjectStatus;
    statusNote?: string | null;
    types: ProjectType[];
    /** 1 is the photographic stage; 2 and 3 are featured beside it. */
    featured?: number | null;
    myRole?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    /** `year`: only the years of the dates are known; never print a month. */
    datePrecision?: TimelineDatePrecision | null;
    /** The dates are the owner's estimate: print them with "c.". */
    datesApproximate?: boolean | null;
    technologies?: string[] | null;
    highlights?: string[] | null;
    parameters?: ProjectParameter[] | null;
    cover?: SanityImageValue | null;
    coverPortrait?: SanityImageValue | null;
    links?: ExternalLink[] | null;
    hasModel: boolean;
};

export type ProjectResult = {
    _key: string;
    metric: string;
    value: string;
    note?: string | null;
};

export type ModelHotspot = {
    _key: string;
    label: string;
    title: string;
    body?: string | null;
    /** Procedural models: the part the balloon points at. */
    part?: ModelPartKey | null;
    /** glTF models: where the balloon points, in model coordinates. */
    position?: { x: number; y: number; z: number } | null;
    /** A heading id in this project's essay, or in the post `postId`. */
    anchor?: { heading: string; postId?: string | null } | null;
};

export type ProjectModel = {
    kind: ModelKind;
    procedural?: ProceduralModelKey | null;
    fileUrl?: string | null;
    poster: SanityImageValue;
    title?: string | null;
    alt: string;
    realWorld?: {
        dimension: RealWorldDimension;
        value: number;
        unit: RealWorldUnit;
    } | null;
    hotspots?: ModelHotspot[] | null;
};

export type ProjectWithBody = ProjectListItem & {
    brief?: {
        problem?: string | null;
        approach?: string | null;
        outcome?: string | null;
    } | null;
    results?: ProjectResult[] | null;
    lessons?: string[] | null;
    next?: string[] | null;
    model?: ProjectModel | null;
    body: ContentBody;
};

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
    _createdAt,
    _updatedAt,
    name,
    headline,
    tagline,
    introduction,
    bio,
    availability{
        status, "seeking": seeking[]{_key, label}, openTo, cta,
        consultingOpen, updatedAt
    },
    launch{date, precision, event},
    focusAreas,
    workSummary,
    writingDescription,
    contactInvitation,
    projectsIntro,
    contactIntro,
    contactRoutes{
        hiring{title, prompt},
        research{title, prompt},
        consulting{title, prompt},
        hello{title, prompt}
    },
    seoDescription,
    "featuredPostId": featuredPost._ref,
    "startHereIds": startHere[]._ref,
    location,
    portrait,
    "resumeUrl": resume.asset->url,
    "resumeUploadedAt": resume.asset->_createdAt,
    resumeNote,
    socialLinks[]{_key, _type, label, url, kind},
    currentCuriosities[]{
        _key, _type, kind, title, note, url,
        "projectId": project._ref,
        "postId": post._ref
    },
    curiositiesUpdatedAt,
    timeline[]{
        _key, _type, kind, title, organization, orgShort, orgUrl, employment,
        location, startDate, startPrecision, endDate, endPrecision,
        isCurrent, expectedEndYear,
        summary, highlights, skills, logo, burn{label, note}
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
    },
    talksAndPapers[]{
        _key, _type, title, kind, venue, date, authors,
        links[]{_key, _type, label, url, kind},
        abstract,
        "projectId": project._ref
    }
}`);

const postCoverProjection = `cover{
    ${imageMetadataProjection},
    "bg": asset->metadata.palette.dominant.background
}`;

/** The list fields every post query shares (never the body). */
const postListFields = `
    title,
    "slug": slug.current,
    description,
    publishedAt,
    revisedAt,
    tags,
    "projectIds": projects[]._ref,
    ${postCoverProjection},
    "wordCount": length(string::split(pt::text(body), " "))`;

export const POST_LIST_QUERY = defineQuery(`*[
    _type == "post" && defined(publishedAt) && publishedAt <= $today
] | order(publishedAt desc){
    _id,${postListFields}
}`);

/** A project's Flight Log entries: published posts that reference it. */
export const POSTS_BY_PROJECT_QUERY = defineQuery(`*[
    _type == "post" && defined(publishedAt) && publishedAt <= $today &&
    references($projectId)
] | order(publishedAt desc){
    _id,${postListFields}
}`);

/** A post's changelog: detail queries only (the page and the feed). */
const postChangelogProjection = `changelog[]{_key, date, kind, note}`;

/** The feed's posts, newest first: the first `$limit`, sliced here so
 *  the payload stays the feed's size as the archive grows. */
export const RECENT_POSTS_QUERY = defineQuery(`*[
    _type == "post" && defined(publishedAt) && publishedAt <= $today
] | order(publishedAt desc)[0...$limit]{
    _id,
    _updatedAt,${postListFields},
    ${postChangelogProjection},
    ${contentBodyProjection}
}`);

export const POST_BY_SLUG_QUERY = defineQuery(`*[
    _type == "post" && slug.current == $slug &&
    defined(publishedAt) && publishedAt <= $today
][0]{
    _id,
    _updatedAt,${postListFields},
    ${postChangelogProjection},
    ${contentBodyProjection}
}`);

export const POST_META_QUERY = defineQuery(`*[
    _type == "post" && slug.current == $slug &&
    defined(publishedAt) && publishedAt <= $today
][0]{
    _updatedAt,${postListFields}
}`);

export const POST_SLUGS_QUERY = defineQuery(`*[
    _type == "post" && defined(publishedAt) && publishedAt <= $today
].slug.current`);

/** The sitemap's posts with the dates they record (`lastRevised` in
 *  lib/log-index.ts), never `_updatedAt`, which any edit moves. */
export const POST_SLUGS_WITH_DATES_QUERY = defineQuery(`*[
    _type == "post" && defined(publishedAt) && publishedAt <= $today
]{"slug": slug.current, publishedAt, revisedAt, "changes": changelog[].date}`);

/** The list fields every project query shares (never the essay). */
const projectListFields = `
    _id,
    _updatedAt,
    designation,
    title,
    name,
    "slug": slug.current,
    summary,
    status,
    statusNote,
    types,
    featured,
    myRole,
    startDate,
    endDate,
    datePrecision,
    datesApproximate,
    technologies,
    highlights,
    parameters[]{_key, label, value},
    cover{${imageMetadataProjection}},
    coverPortrait{${imageMetadataProjection}},
    links[]{_key, _type, label, url, kind},
    "hasModel": defined(model)`;

export const PROJECT_LIST_QUERY = defineQuery(`*[
    _type == "project" && defined(slug.current)
] | order(coalesce(endDate, startDate, _createdAt) desc){${projectListFields}
}`);

export const PROJECT_BY_SLUG_QUERY = defineQuery(`*[
    _type == "project" && slug.current == $slug
][0]{${projectListFields},
    brief{problem, approach, outcome},
    results[]{_key, metric, value, note},
    lessons,
    next,
    model{
        kind,
        procedural,
        "fileUrl": file.asset->url,
        poster{${imageMetadataProjection}},
        title,
        alt,
        realWorld{dimension, value, unit},
        hotspots[]{
            _key, label, title, body, part,
            position{x, y, z},
            anchor{heading, "postId": post._ref}
        }
    },
    ${contentBodyProjection}
}`);

export const PROJECT_SLUGS_QUERY = defineQuery(
    `*[_type == "project" && defined(slug.current)].slug.current`,
);

export const PROJECT_SLUGS_WITH_DATES_QUERY = defineQuery(`*[
    _type == "project" && defined(slug.current)
]{"slug": slug.current, "updatedAt": _updatedAt}`);

/**
 * The published post slugs with their tags, and the project slugs: what
 * cache warming expands `[slug]` and `[tag]` routes from.
 */
export const WARM_LISTS_QUERY = defineQuery(`{
    "posts": *[
        _type == "post" && defined(publishedAt) && publishedAt <= $today
    ]{"slug": slug.current, tags},
    "projectSlugs": *[_type == "project" && defined(slug.current)].slug.current
}`);

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

/** Published posts whose `projects` include this project id. */
export function getPostsByProject(projectId: string): Promise<PostListItem[]> {
    return sanityFetch(
        POSTS_BY_PROJECT_QUERY,
        { projectId },
        CACHE_TAGS.post,
        [],
    );
}

export function getRecentPostsWithBody(limit = 20): Promise<PostWithBody[]> {
    const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit) || 1));
    return sanityFetch<PostWithBody[]>(
        RECENT_POSTS_QUERY,
        { limit: safeLimit },
        CACHE_TAGS.post,
        [],
    );
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

/** A post's address and the dates it records, for the sitemap. */
export type PostDates = {
    slug: string;
    publishedAt: string;
    revisedAt?: string | null;
    changes?: (string | null)[] | null;
};

export function getAllSlugsWithDates(): Promise<PostDates[]> {
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

export type WarmSource = {
    posts: { slug: string; tags: string[] }[];
    projectSlugs: string[];
};

/**
 * The lists `warm(tag)` expands its routes from, read uncached from the
 * live API (not the Sanity CDN). The webhook and the cron call it right after
 * `revalidateTag(…, "max")`, when the cached lists are still the stale ones,
 * so a post or project published a moment ago would not be warmed. This is
 * the one read outside `sanityFetch` besides the cron's due-post check
 * (CLAUDE.md, caching contract). Without Sanity (fixture builds, tests) it
 * reads the cached fixture lists instead.
 */
export async function getWarmLists(): Promise<WarmSource> {
    if (!isSanityConfigured) {
        const [posts, projectSlugs] = await Promise.all([
            getAllPosts(),
            getAllProjectSlugs(),
        ]);
        return {
            posts: posts.map(({ slug, tags }) => ({ slug, tags: tags ?? [] })),
            projectSlugs,
        };
    }
    const today = new Date().toISOString().slice(0, 10);
    const lists = await client
        .withConfig({ useCdn: false })
        .fetch<WARM_LISTS_QUERY_RESULT>(WARM_LISTS_QUERY, { today });
    return {
        posts: (lists?.posts ?? []).map(({ slug, tags }) => ({
            slug,
            tags: tags ?? [],
        })),
        projectSlugs: (lists?.projectSlugs ?? []).filter(
            (slug): slug is string => Boolean(slug),
        ),
    };
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
