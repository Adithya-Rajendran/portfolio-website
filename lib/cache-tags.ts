/** The complete public-content cache taxonomy. */
export const CACHE_TAGS = {
    profile: "profile",
    post: "post",
    project: "project",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];
