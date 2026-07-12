import { cn } from "@/lib/utils";

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
                "mx-auto w-full max-w-6xl px-6 sm:px-8",
                "[&>*+*]:mt-20 sm:[&>*+*]:mt-28",
                className,
            )}
        >
            {children}
        </div>
    );
}
