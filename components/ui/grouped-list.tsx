import Link from "next/link";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { IconPill } from "./icon-pill";

interface GroupedListProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Tiny uppercase label rendered above the card */
    label?: string;
}

/**
 * Samsung One UI-style grouped list — the canonical settings-group
 * pattern. Renders children as rows in a single rounded card with
 * divider lines between them. Pair with <ListRow> children.
 */
export function GroupedList({
    label,
    className,
    children,
    ...rest
}: GroupedListProps) {
    return (
        <div className={cn("w-full", className)} {...rest}>
            {label && (
                <p className="px-5 mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {label}
                </p>
            )}
            <div className="os-card overflow-hidden divide-y divide-slate-200/60 dark:divide-white/[0.06]">
                {children}
            </div>
        </div>
    );
}

interface ListRowProps extends Omit<
    React.HTMLAttributes<HTMLElement>,
    "title" | "onClick"
> {
    href?: string;
    target?: string;
    rel?: string;
    /** Renders the row as a <button> — mutually exclusive with href */
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
    iconColor?: "c1" | "c2" | "c3" | "neutral";
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    /** Right-aligned value or status — strings render as muted text */
    value?: React.ReactNode;
    /** Show a chevron at the end — defaults to true when href is set */
    chevron?: boolean;
}

export function ListRow({
    href,
    target,
    rel,
    onClick,
    icon: Icon,
    iconColor = "c1",
    title,
    subtitle,
    value,
    chevron,
    className,
    ...rest
}: ListRowProps) {
    const showChevron = chevron ?? !!href;
    const interactive = !!href || !!onClick;

    const content = (
        <>
            {Icon && <IconPill icon={Icon} color={iconColor} />}
            <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 dark:text-slate-100 leading-snug">
                    {title}
                </p>
                {subtitle && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        {subtitle}
                    </p>
                )}
            </div>
            {value && (
                <div className="text-sm text-slate-500 dark:text-slate-400 flex-shrink-0">
                    {value}
                </div>
            )}
            {showChevron && (
                <ChevronRight
                    aria-hidden
                    className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0"
                />
            )}
        </>
    );

    const sharedClasses = cn(
        "flex items-center gap-4 px-5 py-4 sm:px-6 transition-colors w-full text-left",
        interactive &&
            // The negative outline offset keeps the focus ring visible
            // inside the GroupedList card's overflow-hidden clipping.
            "hover:bg-slate-100/60 dark:hover:bg-white/[0.03] cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[rgb(var(--c1))]",
        className,
    );

    if (href) {
        const isExternal = /^https?:\/\//.test(href);
        if (isExternal || target) {
            return (
                <a
                    href={href}
                    target={target}
                    rel={rel}
                    className={sharedClasses}
                    {...rest}
                >
                    {content}
                </a>
            );
        }
        return (
            <Link href={href} className={sharedClasses} {...rest}>
                {content}
            </Link>
        );
    }
    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                className={sharedClasses}
                {...rest}
            >
                {content}
            </button>
        );
    }
    return (
        <div className={sharedClasses} {...rest}>
            {content}
        </div>
    );
}
