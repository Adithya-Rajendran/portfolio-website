import { cn } from "@/lib/utils";

interface IconPillProps {
    /** Lucide / react-icons component to render inside */
    icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
    /** Visual size — md is the One UI standard for list rows */
    size?: "sm" | "md" | "lg";
    /** Which accent color the squircle picks up */
    color?: "c1" | "c2" | "c3" | "neutral";
    className?: string;
}

const sizeStyles = {
    sm: "w-9 h-9 [&_svg]:w-4 [&_svg]:h-4",
    md: "w-11 h-11 [&_svg]:w-[18px] [&_svg]:h-[18px]",
    lg: "w-14 h-14 [&_svg]:w-6 [&_svg]:h-6",
} as const;

const colorStyles = {
    c1: "bg-c1-soft text-accent border-c1-soft",
    c2: "bg-c2-soft text-c2 border-c2-soft",
    c3: "bg-c3-soft text-c3 border-c3-soft",
    neutral:
        "bg-slate-100 text-slate-600 border-slate-200/60 dark:bg-white/[0.06] dark:text-slate-300 dark:border-white/10",
} as const;

/**
 * Squircle icon tile in the Samsung One UI 8 style — a continuous-curve
 * rounded square, not a circle. Used wherever an icon sits next to a
 * label (skill cards, nav cards, stats rows, settings rows, etc.) —
 * every accent-colored icon on the site should be wrapped in one of
 * these for visual consistency.
 */
export function IconPill({
    icon: Icon,
    size = "md",
    color = "c1",
    className,
}: IconPillProps) {
    return (
        <div
            className={cn(
                "inline-flex items-center justify-center rounded-squircle border shrink-0",
                sizeStyles[size],
                colorStyles[color],
                className,
            )}
        >
            <Icon aria-hidden />
        </div>
    );
}
