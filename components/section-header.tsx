import { cn } from "@/lib/utils";

interface SectionHeaderProps {
    eyebrow?: string;
    title: React.ReactNode;
    description?: React.ReactNode;
    align?: "left" | "center";
    className?: string;
}

/**
 * Unified section header — small accent eyebrow + display title +
 * optional description. The accent line and eyebrow color both pull
 * from the active theme.
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
                <div
                    className={cn(
                        "flex items-center gap-2 mb-4",
                        align === "center" && "justify-center",
                    )}
                >
                    <span className="inline-block w-6 h-px bg-accent-gradient" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
                        {eyebrow}
                    </p>
                </div>
            )}
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white text-balance">
                {title}
            </h2>
            {description && (
                <p
                    className={cn(
                        "mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed text-pretty",
                        align === "center" ? "max-w-2xl mx-auto" : "max-w-3xl",
                    )}
                >
                    {description}
                </p>
            )}
        </header>
    );
}
