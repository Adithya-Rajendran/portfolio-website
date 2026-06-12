import { cn } from "@/lib/utils";
import Link from "next/link";

interface CardProps extends React.HTMLAttributes<HTMLElement> {
    href?: string;
    target?: string;
    rel?: string;
    /** Removes the default padding; use when the card needs flush imagery. */
    flush?: boolean;
}

/**
 * Polymorphic clickable card — renders a <Link> when `href` is set
 * (internal), an <a> for external links, otherwise an <article>.
 * Uses the One UI-style elevated surface with a hover lift.
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
        "group relative block os-card os-hover overflow-hidden",
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
