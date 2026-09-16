import Link from "next/link";
import { cn } from "@/lib/utils";

interface TagChipsProps {
    tags: { tag: string; count?: number }[];
    active?: string;
    className?: string;
}

export default function TagChips({ tags, active, className }: TagChipsProps) {
    if (!tags.length) return null;
    return (
        <nav aria-label="Topics" className={cn("journal-tag-links", className)}>
            {tags.map(({ tag, count }) => (
                <Link
                    key={tag}
                    href={`/blog/tags/${tag}`}
                    aria-current={tag === active ? "page" : undefined}
                >
                    {tag}
                    {typeof count === "number" && (
                        <span className="journal-tag-count">{count}</span>
                    )}
                </Link>
            ))}
        </nav>
    );
}
