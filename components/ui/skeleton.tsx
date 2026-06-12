import { cn } from "@/lib/utils";

/**
 * Shimmer placeholder block. The single source for skeleton styling —
 * page-level loading states compose these instead of repeating the
 * pulse/color combo inline.
 */
export function Skeleton({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                "animate-pulse rounded-2xl bg-slate-200/60 dark:bg-white/[0.05]",
                className,
            )}
            {...props}
        />
    );
}
