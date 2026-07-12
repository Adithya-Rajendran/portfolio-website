import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeadingProps {
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    headingId?: string;
    className?: string;
}

/** Shared heading rhythm for page sections and content indexes. */
export function SectionHeading({
    title,
    description,
    action,
    headingId,
    className,
}: SectionHeadingProps) {
    return (
        <header
            className={cn(
                "mb-9 border-t border-slate-300/70 pt-6 dark:border-white/10 sm:mb-12",
                className,
            )}
        >
            <div
                className={cn(
                    action &&
                        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
                )}
            >
                <div className="min-w-0">
                    <h2
                        id={headingId}
                        className="max-w-3xl font-display text-3xl font-semibold leading-tight tracking-[-0.035em] text-slate-950 text-balance dark:text-white sm:text-4xl"
                    >
                        {title}
                    </h2>
                    {description && (
                        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 text-pretty dark:text-slate-300 sm:text-lg">
                            {description}
                        </p>
                    )}
                </div>
                {action}
            </div>
        </header>
    );
}
