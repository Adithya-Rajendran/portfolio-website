import { cn } from "@/lib/utils";

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Adds a hover lift + accent glow — use for interactive cards */
    interactive?: boolean;
    /** Use the more opaque variant (for the hero / featured panel) */
    elevated?: boolean;
    /** Drop the default p-6 sm:p-7 padding for flush imagery */
    flush?: boolean;
    /** Use a custom radius — defaults to rounded-3xl (24px) */
    radius?: "lg" | "xl" | "2xl" | "3xl";
    as?: React.ElementType;
}

const radiusMap = {
    lg: "rounded-2xl",
    xl: "rounded-[20px]",
    "2xl": "rounded-3xl",
    "3xl": "rounded-[28px]",
} as const;

/**
 * The single card surface used across the site. Renders as a div by
 * default; pass `as` to use a different tag (e.g. `section`). For
 * polymorphic link/article behavior see <Card>.
 */
export function Surface({
    interactive = false,
    elevated = false,
    flush = false,
    radius = "2xl",
    as: Tag = "div",
    className,
    children,
    ...rest
}: SurfaceProps) {
    return (
        <Tag
            className={cn(
                elevated ? "glass-strong" : "os-card",
                radiusMap[radius],
                interactive && "os-hover",
                !flush && "p-6 sm:p-7",
                className,
            )}
            {...rest}
        >
            {children}
        </Tag>
    );
}
