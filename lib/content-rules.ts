/** Stable newest-first ordering for authored publish datetimes. */
export function newestFirst<T extends { publishedAt?: string | null }>(
    items: readonly T[],
): T[] {
    return [...items].sort((left, right) =>
        (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""),
    );
}
