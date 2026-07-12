import Link from "next/link";
import { cn } from "@/lib/utils";

interface TagChipsProps {
    tags: { tag: string; count?: number }[];
    /** Tag to highlight as current (e.g. the tag page being viewed). */
    active?: string;
    className?: string;
}

/**
 * Compact links to each tag archive. Hashes provide familiar blog metadata
 * without borrowing the homepage's bracket-command treatment.
 */
export default function TagChips({ tags, active, className }: TagChipsProps) {
    if (!tags || tags.length === 0) return null;

    return (
        <nav
            aria-label="Tags"
            className={cn("flex flex-wrap gap-2", className)}
        >
            {tags.map(({ tag, count }) => {
                const isActive = tag === active;
                return (
                    <Link
                        key={tag}
                        href={`/blog/tags/${tag}`}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                            "inline-flex min-h-11 items-center rounded-full border px-3 font-term text-[0.78rem] whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c1))]",
                            isActive
                                ? "border-accent-soft bg-accent-soft font-bold text-accent"
                                : "border-slate-400/25 text-slate-600 hover:border-accent-soft hover:text-accent dark:border-white/10 dark:text-slate-400",
                        )}
                    >
                        <span aria-hidden># </span>
                        {tag}
                        {typeof count === "number" && (
                            <span className="tabular-nums opacity-70">
                                {" "}
                                {count}
                            </span>
                        )}
                    </Link>
                );
            })}
        </nav>
    );
}
