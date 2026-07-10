import Link from "next/link";
import { cn } from "@/lib/utils";

interface TagChipsProps {
    tags: { tag: string; count?: number }[];
    /** Tag to highlight as current (e.g. the tag page being viewed). */
    active?: string;
    className?: string;
}

/**
 * Row of pill links to each tag's archive page (/blogs/tags/[tag]). The
 * active tag gets the same accent-soft "current" treatment used by the
 * header nav (see components/header.tsx); the rest render as neutral
 * glass pills that lift on hover.
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
                        href={`/blogs/tags/${tag}`}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                            "inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors",
                            isActive
                                ? "text-accent bg-accent-soft border border-accent-soft"
                                : "os-card-flat os-hover text-slate-600 hover:text-accent dark:text-slate-300",
                        )}
                    >
                        {tag}
                        {typeof count === "number" && (
                            <span
                                className={cn(
                                    "text-xs tabular-nums",
                                    isActive
                                        ? "text-accent/70"
                                        : "text-slate-400 dark:text-slate-500",
                                )}
                            >
                                {count}
                            </span>
                        )}
                    </Link>
                );
            })}
        </nav>
    );
}
