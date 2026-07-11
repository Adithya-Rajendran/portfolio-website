import { cn } from "@/lib/utils";

interface SectionHeadingProps {
    title: string;
    description?: string;
    className?: string;
}

/** A shared editorial heading for the long-form work page. */
export default function SectionHeading({
    title,
    description,
    className,
}: SectionHeadingProps) {
    return (
        <header
            className={cn(
                "mb-9 border-t border-slate-300/70 pt-6 dark:border-white/10 sm:mb-12",
                className,
            )}
        >
            <div>
                <h2 className="max-w-3xl font-display text-3xl font-semibold leading-tight tracking-[-0.035em] text-slate-950 text-balance dark:text-white sm:text-4xl">
                    {title}
                </h2>
                {description && (
                    <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 text-pretty dark:text-slate-300 sm:text-lg">
                        {description}
                    </p>
                )}
            </div>
        </header>
    );
}
