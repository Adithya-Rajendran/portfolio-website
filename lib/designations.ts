/**
 * Designations printed next to titles. A mission's number is stored on the
 * project (`designation`), so adding a project never renumbers the others.
 * A Flight Log entry's number is derived: entries are numbered in the
 * order they were filed, so LOG 001 is the oldest published post.
 * Keep this module free of imports: the Studio preview uses it.
 */

/** 2 → "MSN-02" */
export function formatMissionDesignation(designation: number): string {
    return `MSN-${String(designation).padStart(2, "0")}`;
}

/** 3 → "LOG 003" */
export function formatLogDesignation(number: number): string {
    return `LOG ${String(number).padStart(3, "0")}`;
}

/** 3 → "003": the short form on the transmissions chart. */
export function formatLogNumber(number: number): string {
    return String(number).padStart(3, "0");
}

interface Filed {
    slug: string;
    publishedAt?: string | null;
    _id?: string | null;
}

/**
 * Numbers published entries 1…n in the order they were filed: by
 * `publishedAt` (a date, so the ISO string sorts), oldest first. Posts
 * filed on the same day are ordered by document id, which never changes,
 * so the numbers do not depend on the order the list arrives in. A post
 * with no date (the list queries never return one) comes last. Returns
 * slug → number; posts without a slug get none.
 *
 * Numbers are stable while posts are only added after the newest one. A
 * post back-dated before an existing one, or one unpublished, renumbers
 * the entries after it (plan §3.5: store the number if that ever matters).
 */
export function logNumbers(posts: readonly Filed[]): Map<string, number> {
    const filed = posts
        .filter((post) => post.slug)
        .map((post) => ({
            slug: post.slug,
            date: /^\d{4}-\d{2}-\d{2}/.test(post.publishedAt ?? "")
                ? (post.publishedAt ?? "")
                : "",
            id: post._id ?? post.slug,
        }));
    filed.sort((a, b) => {
        if (a.date !== b.date) {
            if (!a.date) return 1;
            if (!b.date) return -1;
            return a.date < b.date ? -1 : 1;
        }
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return new Map(filed.map(({ slug }, index) => [slug, index + 1]));
}
