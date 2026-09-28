import Link from "next/link";
import type { ComponentProps } from "react";
import { Icon, type IconName } from "@/components/ui/icon";

/**
 * Buttons (the mockup's `.btn`): a hairline box, Jost caps, radius 0.
 * `primary` is the orange fill with dark ink (white on orange is never
 * used), `quiet` drops the box. Links that look like buttons stay real
 * links (<ButtonLink>), so middle-click and "open in new tab" work.
 */

type Variant = "default" | "primary" | "quiet";
type Size = "md" | "sm";

interface Look {
    variant?: Variant;
    size?: Size;
    icon?: IconName;
    /** Where the icon sits; a trailing arrow nudges on hover. */
    iconAt?: "start" | "end";
}

export function buttonClass({
    variant = "default",
    size = "md",
    className,
}: Look & { className?: string }): string {
    return [
        "btn",
        variant !== "default" && `btn--${variant}`,
        size === "sm" && "btn--sm",
        className,
    ]
        .filter(Boolean)
        .join(" ");
}

function Content({
    icon,
    iconAt = "start",
    children,
}: Look & { children: React.ReactNode }) {
    if (!icon) return <>{children}</>;
    const glyph = (
        <Icon name={icon} className={iconAt === "end" ? "icon--nudge" : ""} />
    );
    return iconAt === "end" ? (
        <>
            {children}
            {glyph}
        </>
    ) : (
        <>
            {glyph}
            {children}
        </>
    );
}

export function Button({
    variant,
    size,
    icon,
    iconAt,
    className,
    type = "button",
    children,
    ...props
}: Look & ComponentProps<"button">) {
    return (
        <button
            type={type}
            className={buttonClass({ variant, size, className })}
            {...props}
        >
            <Content icon={icon} iconAt={iconAt}>
                {children}
            </Content>
        </button>
    );
}

export function ButtonLink({
    variant,
    size,
    icon,
    iconAt,
    className,
    children,
    ...props
}: Look & ComponentProps<typeof Link>) {
    return (
        <Link className={buttonClass({ variant, size, className })} {...props}>
            <Content icon={icon} iconAt={iconAt}>
                {children}
            </Content>
        </Link>
    );
}
