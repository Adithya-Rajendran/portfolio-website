export type CredentialLifecycle = "active" | "lifetime" | "expired";

/** Shared empty-state rule for optional CMS arrays. */
export function hasVisibleItems<T>(
    items: readonly T[] | null | undefined,
): items is readonly [T, ...T[]] {
    return Array.isArray(items) && items.length > 0;
}

/** Derive the honest public status of a credential at a given UTC date. */
export function credentialLifecycle(
    credential: { lifetime?: boolean; expiresOn?: string | null },
    today = new Date().toISOString().slice(0, 10),
): CredentialLifecycle {
    if (credential.lifetime) return "lifetime";
    if (credential.expiresOn && credential.expiresOn < today) return "expired";
    return "active";
}

/** Stable newest-first ordering for authored publish datetimes. */
export function newestFirst<T extends { publishedAt?: string | null }>(
    items: readonly T[],
): T[] {
    return [...items].sort((left, right) =>
        (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""),
    );
}
