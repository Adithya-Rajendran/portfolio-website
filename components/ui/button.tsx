import Link from "next/link";
import type { ComponentProps } from "react";
import { Icon, type IconName } from "@/components/ui/icon";

/**
 * Buttons (the mockup's `.btn`): a hairline box, the controls' Jost caps,
 * radius 0. `primary` is an ink fill with a label in the page's colour,
 * `quiet` drops the box. Links that look like buttons stay real
 * links (<ButtonLink>), so middle-click and "open in new tab" work;
 * `plain` renders a plain <a> in place of next/link's, for an address
 * the router does not serve (a download, another site).
 */

type Variant = "default" | "primary" | "quiet";
type Size = "md" | "sm";

interface Look {
    variant?: Variant;
    size?: Size;
    icon?: IconName;
    /** Where the icon sits; a trailing arrow nudges on hover (an
     *  outbound ↗ never does). */
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
        <Icon
            name={icon}
            className={
                iconAt === "end" && icon === "arrow" ? "icon--nudge" : undefined
            }
        />
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

type LinkProps = Look & { plain?: false } & ComponentProps<typeof Link>;
type AnchorProps = Look & { plain: true } & ComponentProps<"a">;

export function ButtonLink({
    plain,
    variant,
    size,
    icon,
    iconAt,
    className,
    children,
    ...props
}: LinkProps | AnchorProps) {
    const look = buttonClass({ variant, size, className });
    const content = (
        <Content icon={icon} iconAt={iconAt}>
            {children}
        </Content>
    );
    // The rest of a union does not narrow with `plain`: each branch names
    // the props it was given.
    return plain ? (
        <a className={look} {...(props as ComponentProps<"a">)}>
            {content}
        </a>
    ) : (
        <Link className={look} {...(props as ComponentProps<typeof Link>)}>
            {content}
        </Link>
    );
}
