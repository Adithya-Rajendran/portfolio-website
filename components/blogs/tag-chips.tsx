import Link from "next/link";
import { cn } from "@/lib/utils";

interface TagChipsProps {
    tags: { tag: string; count?: number }[];
    /** Tag to highlight as current (e.g. the tag page being viewed). */
    active?: string;
    className?: string;
}

/**
 * Row of mono bracket-command links to each tag's archive page
 * (/blogs/tags/[tag]) — `[ kubernetes 4 ]`. The brackets are decorative
 * (aria-hidden) so assistive tech reads just the tag and count; the
 * active tag renders bold in the accent color.
 */
export default function TagChips({ tags, active, className }: TagChipsProps) {
    if (!tags || tags.length === 0) return null;

    return (
        <nav
            aria-label="Tags"
            className={cn("flex flex-wrap gap-x-4 gap-y-2", className)}
        >
            {tags.map(({ tag, count }) => {
                const isActive = tag === active;
                return (
                    <Link
                        key={tag}
                        href={`/blogs/tags/${tag}`}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                            "font-term text-[0.8rem] whitespace-nowrap transition-colors",
                            isActive
                                ? "font-bold text-accent"
                                : "text-slate-600 dark:text-slate-400 hover:text-accent",
                        )}
                    >
                        <span aria-hidden>[ </span>
                        {tag}
                        {typeof count === "number" && (
                            <span className="tabular-nums opacity-70">
                                {" "}
                                {count}
                            </span>
                        )}
                        <span aria-hidden> ]</span>
                    </Link>
                );
            })}
        </nav>
    );
}
