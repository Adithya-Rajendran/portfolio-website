/**
 * Pages not yet converted to Deep Field (plan §6.1). They render their old
 * layout inside the new chrome through the compat shim
 * (styles/compat-journal.css, `data-legacy` on the page root), whose
 * hard-coded colours are dark-only. So the a11y spec checks them in full in
 * Void only, and only the chrome (header and footer) in Flight Manual.
 *
 * Each converting PR removes its entries. The list is empty after PR 14,
 * which deletes the shim and app/journal-*.css.
 */
const LEGACY_ROUTES: { pattern: RegExp; until: string }[] = [
    { pattern: /^\/$/, until: "PR 13 (home)" },
    { pattern: /^\/resume$/, until: "PR 11 (trajectory)" },
    { pattern: /^\/portfolio(\/[^/]+)?$/, until: "PR 12 (missions)" },
    { pattern: /^\/about$/, until: "PR 14 (crew file)" },
];

/** True for a page still on the legacy layout. */
export function isLegacyRoute(path: string): boolean {
    return LEGACY_ROUTES.some(({ pattern }) => pattern.test(path));
}
