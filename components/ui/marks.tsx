import Link from "next/link";
import type { ComponentProps } from "react";
import { Icon } from "@/components/ui/icon";
import { formatEntryDate } from "@/lib/log-index";

/**
 * Small marks of the design system: the arrow link, status, the paper's
 * revision mark and Updated (the mockup's site.css 4.4–4.5, 4.27).
 * Directive-free, so server and client components can both render them.
 */

/** "All entries →": a caps link on an ink hairline, with a nudging arrow. */
export function LinkArrow({
    children,
    className,
    icon = "arrow",
    ...props
}: ComponentProps<typeof Link> & {
    /** "arrow-down" for a link further down the page. */
    icon?: "arrow" | "arrow-down";
}) {
    return (
        <Link
            className={className ? `link-arrow ${className}` : "link-arrow"}
            {...props}
        >
            {children}
            <Icon name={icon} />
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
    | "lifetime";

/**
 * A glyph and a label, never colour alone (plan §4.5). The label is the
 * visible text; the glyph is drawn by CSS from `data-status`, or for
 * Stopped is the sprite's cross (no font glyph).
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
            {value === "stopped" ? (
                <Icon name="close" className="status__icon" />
            ) : null}
            {children}
        </span>
    );
}

/** "Rev 2026-09-24": the printed CV's revision, on paper only (G3). */
export function Rev({ date }: { /** `YYYY-MM-DD` */ date: string }) {
    return (
        <span className="rev">
            Rev <time dateTime={date}>{date}</time>
        </span>
    );
}

/**
 * "Updated 24 Sep 2026": when a list was last updated, in words. `Rev`
 * (ISO) is the printed CV's alone (contract §2).
 */
export function Updated({
    date,
    label = "Updated",
}: {
    /** `YYYY-MM-DD` */
    date: string;
    label?: string;
}) {
    return (
        <span className="updated">
            {label} <time dateTime={date}>{formatEntryDate(date)}</time>
        </span>
    );
}
