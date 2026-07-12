import type { ReactNode } from "react";
import { PAGE_CONTAINER_CLASSES } from "@/components/page-shell";
import { cn } from "@/lib/utils";

interface PageIntroProps {
    title: ReactNode;
    lead?: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    size?: "default" | "compact";
    id?: string;
    headingId?: string;
    className?: string;
}

/**
 * Shared route introduction for editorial pages. Home, articles, the PDF
 * viewer, and terminal error screens intentionally keep their own anatomy.
 */
export function PageIntro({
    title,
    lead,
    description,
    actions,
    size = "default",
    id,
    headingId,
    className,
}: PageIntroProps) {
    return (
        <header id={id} className={cn(PAGE_CONTAINER_CLASSES, className)}>
            <h1
                id={headingId}
                className={cn(
                    "max-w-4xl font-display font-semibold leading-[0.98] tracking-[-0.05em] text-slate-950 text-balance dark:text-white",
                    size === "default"
                        ? "text-5xl sm:text-6xl lg:text-7xl"
                        : "text-4xl sm:text-6xl",
                )}
            >
                {title}
            </h1>

            {lead && (
                <p className="mt-6 max-w-3xl font-display text-xl font-medium leading-snug text-slate-700 text-pretty dark:text-slate-200 sm:text-2xl">
                    {lead}
                </p>
            )}

            {description && (
                <div
                    className={cn(
                        "max-w-3xl text-base leading-8 text-slate-600 text-pretty dark:text-slate-300 sm:text-lg",
                        lead ? "mt-5" : "mt-6",
                    )}
                >
                    {description}
                </div>
            )}

            {actions && (
                <div className="mt-9 flex flex-wrap gap-3">{actions}</div>
            )}
        </header>
    );
}
