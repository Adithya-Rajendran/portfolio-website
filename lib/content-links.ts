/**
 * Link annotations in Portable Text. The Studio writes `contentLink`
 * markDefs (sanity/schemas/objects/contentLink.ts); older documents may
 * still carry legacy `link` markDefs. Both have the shape `{ href }` and
 * render the same way on the web (components/blogs/portable-text-components.tsx)
 * and in RSS (lib/feed.ts).
 */
export const LINK_MARK_TYPES = ["contentLink", "link"] as const;

export interface ResolvedLinkMark {
    href: string;
    /** Opens in a new tab with `rel="noopener noreferrer"`. */
    external: boolean;
}

/**
 * No `mailto:`: the site publishes no email address (contact is the form
 * only), so an email link authored before this rule renders as plain text.
 */
const ALLOWED_PROTOCOLS = ["http:", "https:"];

/**
 * Resolve a link markDef to a safe `href`, or null when the value is
 * missing or unsafe (the text then renders without a link).
 *
 * - Site-relative paths (`/blog/x`) and fragments (`#section`) pass through.
 *   `//host` and `/\host` are protocol-relative in browsers, so they are not
 *   treated as site-relative.
 * - Absolute URLs must use http or https, and are external.
 */
export function resolveLinkMark(value: unknown): ResolvedLinkMark | null {
    const href =
        value && typeof value === "object"
            ? (value as { href?: unknown }).href
            : undefined;
    if (typeof href !== "string") return null;
    const trimmed = href.trim();
    if (!trimmed) return null;

    if (/^\/(?![/\\])/.test(trimmed) || trimmed.startsWith("#")) {
        return { href: trimmed, external: false };
    }

    try {
        const url = new URL(trimmed);
        if (!ALLOWED_PROTOCOLS.includes(url.protocol)) return null;
        return { href: url.href, external: true };
    } catch {
        return null;
    }
}
