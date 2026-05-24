import { cn } from "@/lib/utils";
import Link from "next/link";

interface CardProps extends React.HTMLAttributes<HTMLElement> {
    href?: string;
    target?: string;
    rel?: string;
    /** Removes the default p-6; use when the card needs flush imagery. */
    flush?: boolean;
}

/**
 * Single source of truth for the bordered-surface card used by project
 * tiles, blog cards, certification cards, and any other "click here"
 * surface across the site.
 *
 * Polymorphic: renders a <Link> when `href` is set (internal), an <a>
 * for external links, otherwise an <article>. Frosted-glass surface
 * with an indigo glow on hover.
 */
export function Card({
    href,
    target,
    rel,
    flush = false,
    className,
    children,
    ...rest
}: CardProps) {
    const sharedClasses = cn(
        "group relative block rounded-2xl overflow-hidden",
        "glass glow-hover",
        !flush && "p-6 sm:p-7",
        className,
    );

    if (href && !target) {
        return (
            <Link href={href} className={sharedClasses} {...rest}>
                {children}
            </Link>
        );
    }
    if (href) {
        return (
            <a
                href={href}
                target={target}
                rel={rel}
                className={sharedClasses}
                {...rest}
            >
                {children}
            </a>
        );
    }
    return (
        <article className={sharedClasses} {...rest}>
            {children}
        </article>
    );
}
