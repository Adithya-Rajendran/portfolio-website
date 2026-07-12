import { cn } from "@/lib/utils";

/** Shared editorial rail for route prompts, introductions, and page sections. */
export const PAGE_CONTAINER_CLASSES = "mx-auto w-full max-w-6xl px-5 sm:px-8";

/**
 * Width and rhythm container for content pages (/portfolio, /blog).
 * Every direct child is a section that gets the same vertical spacing,
 * so individual section components don't each ship their own margins.
 */
export function PageShell({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                PAGE_CONTAINER_CLASSES,
                "[&>*+*]:mt-20 sm:[&>*+*]:mt-28",
                className,
            )}
        >
            {children}
        </div>
    );
}
