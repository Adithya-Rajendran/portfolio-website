import { cn } from "@/lib/utils";

interface PageHeroProps {
    eyebrow?: string;
    title: React.ReactNode;
    /** Optional accent line below the title — e.g. a job tagline. */
    tagline?: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
}

/**
 * Top-of-page hero shared by /portfolio and /blogs.
 */
export default function PageHero({
    eyebrow,
    title,
    tagline,
    description,
    actions,
    children,
    className,
}: PageHeroProps) {
    return (
        <section
            className={cn(
                "relative w-full px-6 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center overflow-hidden",
                className,
            )}
        >
            <div className="mx-auto max-w-3xl">
                {eyebrow && (
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent mb-6">
                        {eyebrow}
                    </p>
                )}
                {children}
                <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-slate-900 dark:text-white text-balance leading-[1.05]">
                    {title}
                </h1>
                {tagline && (
                    <p className="mt-4 text-lg sm:text-xl font-medium text-balance text-accent-gradient">
                        {tagline}
                    </p>
                )}
                {description && (
                    <p className="mt-6 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto text-pretty">
                        {description}
                    </p>
                )}
                {actions && (
                    <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                        {actions}
                    </div>
                )}
            </div>
        </section>
    );
}
