import Link from "next/link";
import type { ComponentProps } from "react";
import { Icon } from "@/components/ui/icon";

/**
 * Small marks of the design system: the arrow link, status, revision mark,
 * tags and chips (the mockup's site.css 4.4–4.5, 4.27).
 * Directive-free, so server and client components can both render them.
 */

/** "All entries →": a caps link with an orange rule and a nudging arrow. */
export function LinkArrow({
    children,
    className,
    ...props
}: ComponentProps<typeof Link>) {
    return (
        <Link
            className={className ? `link-arrow ${className}` : "link-arrow"}
            {...props}
        >
            {children}
            <Icon name="arrow" />
        </Link>
    );
}

export type StatusValue =
    | "active"
    | "complete"
    | "paused"
    | "archived"
    | "planned"
    | "stopped"
    | "expired"
    | "lifetime";

/**
 * A glyph and a label, never colour alone (plan §4.5). The label is the
 * visible text; the glyph is drawn by CSS from `data-status`.
 */
export function Status({
    value,
    children,
}: {
    value: StatusValue;
    children: React.ReactNode;
}) {
    return (
        <span className="status" data-status={value}>
            {children}
        </span>
    );
}

/** △ Rev 2026-09-24: document control and dated revisions (G7). */
export function Rev({
    date,
    label = "Rev",
    title,
}: {
    /** `YYYY-MM-DD` */
    date: string;
    label?: string;
    title?: string;
}) {
    return (
        <span className="rev" title={title}>
            <span className="rev__tri" aria-hidden="true" />
            {label} <time dateTime={date}>{date}</time>
        </span>
    );
}

/** Topic tags as links: "#homelab". */
export function Tags({
    tags,
    href,
}: {
    tags: readonly string[];
    href: (tag: string) => string;
}) {
    if (!tags.length) return null;
    return (
        <ul className="tags" role="list">
            {tags.map((tag) => (
                <li key={tag}>
                    <Link className="tag" href={href(tag)}>
                        {tag}
                    </Link>
                </li>
            ))}
        </ul>
    );
}

/** A filter or tag chip with an optional count; `current` marks it. */
export function Chip({
    children,
    count,
    current,
    className,
    ...props
}: ComponentProps<typeof Link> & { count?: number; current?: boolean }) {
    return (
        <Link
            className={className ? `chip ${className}` : "chip"}
            aria-current={current ? "page" : undefined}
            {...props}
        >
            {children}
            {count === undefined ? null : (
                <span className="chip__count">{count}</span>
            )}
        </Link>
    );
}
