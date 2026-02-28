import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

interface NavCardProps {
    href: string;
    icon: LucideIcon;
    title: string;
    description: string;
    cta: string;
    variant: "primary" | "accent";
    delay?: string;
}

export function NavCard({
    href,
    icon: Icon,
    title,
    description,
    cta,
    variant,
    delay = "0ms",
}: NavCardProps) {
    const isPrimary = variant === "primary";

    return (
        <Link
            href={href}
            className="group relative flex flex-col rounded-2xl border border-border bg-card p-8 sm:p-10 transition-all duration-300 hover:border-primary/30 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring animate-fade-in-up"
            style={{ animationDelay: delay }}
        >
            <div className="relative flex flex-col flex-1">
                <div
                    className={`mb-6 inline-flex items-center justify-center w-12 h-12 rounded-xl ${isPrimary
                        ? "bg-primary/10 text-primary"
                        : "bg-accent/15 text-accent-foreground"
                        }`}
                >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold text-card-foreground mb-3 tracking-tight">
                    {title}
                </h2>
                <p className="text-muted-foreground mb-8 leading-relaxed flex-1">
                    {description}
                </p>
                <span
                    className={`inline-flex items-center gap-2 font-medium transition-all duration-200 group-hover:gap-3 ${isPrimary ? "text-primary" : "text-accent-foreground"
                        }`}
                >
                    {cta}
                    <ArrowRight
                        className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                        aria-hidden="true"
                    />
                </span>
            </div>
        </Link>
    );
}
