import Link from "next/link";
import { LinkArrow } from "@/components/ui/marks";

/**
 * Previous and next (contract §4, generalised from the post's pager in
 * `blogs/article-continuation.tsx`): two hairline-topped links with a
 * label, a title and one line of data, and an optional link to the whole
 * list between them. Only the sides that exist are drawn; nothing stands
 * in for a missing one, and a lone side takes the whole width.
 */

export interface PagerLink {
    href: string;
    /** "Previous" or "Next": the landmark names what the titles are. */
    label: string;
    title: string;
    meta?: string | null;
}

export default function Pager({
    previous,
    next,
    all,
    label,
    className,
}: {
    previous?: PagerLink | null;
    next?: PagerLink | null;
    all?: { href: string; label: string } | null;
    /** The landmark's name. */
    label: string;
    className?: string;
}) {
    if (!previous && !next && !all) return null;
    const item = (link: PagerLink, side: "previous" | "next") => (
        <Link
            className={`pager__item pager__item--${side}`}
            href={link.href}
            rel={side === "next" ? "next" : "prev"}
        >
            <span className="pager__label">{link.label}</span>
            <span className="pager__title">{link.title}</span>
            {link.meta ? (
                <span className="pager__meta">{link.meta}</span>
            ) : null}
        </Link>
    );
    return (
        <nav
            className={className ? `pager ${className}` : "pager"}
            aria-label={label}
        >
            {previous ? item(previous, "previous") : null}
            {all ? (
                <LinkArrow className="pager__all" href={all.href}>
                    {all.label}
                </LinkArrow>
            ) : null}
            {next ? item(next, "next") : null}
        </nav>
    );
}
