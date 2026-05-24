import { cn } from "@/lib/utils";

interface SectionHeaderProps {
    eyebrow?: string;
    title: React.ReactNode;
    description?: React.ReactNode;
    align?: "left" | "center";
    className?: string;
}

/**
 * Unified section header used at the top of every major section on
 * /portfolio and /blogs. Three visual layers:
 *   - tiny uppercase emerald eyebrow (optional)
 *   - large semibold tracking-tight title
 *   - secondary slate description (optional)
 *
 * Default left-aligned so it reads as the heading of a content block;
 * pass align="center" for centered marketing sections.
 */
export default function SectionHeader({
    eyebrow,
    title,
    description,
    align = "left",
    className,
}: SectionHeaderProps) {
    return (
        <header
            className={cn(
                "mb-12 sm:mb-16",
                align === "center" && "text-center",
                className,
            )}
        >
            {eyebrow && (
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-4">
                    {eyebrow}
                </p>
            )}
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 text-balance">
                {title}
            </h2>
            {description && (
                <p
                    className={cn(
                        "mt-4 text-base sm:text-lg text-slate-500 dark:text-slate-400 leading-relaxed text-pretty",
                        align === "center" ? "max-w-2xl mx-auto" : "max-w-3xl",
                    )}
                >
                    {description}
                </p>
            )}
        </header>
    );
}
