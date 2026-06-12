import { Code, ShieldCheck, Server } from "lucide-react";

/**
 * Sanity content uses three colorVariant keys (emerald/cyan/violet)
 * inherited from the original palette. They map onto the three theme
 * accent positions (c1/c2/c3) so existing content adapts to whichever
 * accent theme the visitor has selected.
 *
 * This is the single mapping — icon, IconPill color, badge variant,
 * and utility classes all live here. Consumed by components/home and
 * components/portfolio.
 */

export type AccentSlot = "c1" | "c2" | "c3";

export interface VariantStyle {
    /** Lucide icon shown in the category's IconPill */
    icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
    /** IconPill / accent slot */
    color: AccentSlot;
    badgeVariant: AccentSlot;
    textColor: string;
    bgColor: string;
    borderColor: string;
    wash: string;
}

export const variantStyles: Record<string, VariantStyle> = {
    emerald: {
        icon: Code,
        color: "c1",
        badgeVariant: "c1",
        textColor: "text-accent",
        bgColor: "bg-c1-soft",
        borderColor: "border-c1-soft",
        wash: "bg-c1-wash",
    },
    cyan: {
        icon: ShieldCheck,
        color: "c2",
        badgeVariant: "c2",
        textColor: "text-c2",
        bgColor: "bg-c2-soft",
        borderColor: "border-c2-soft",
        wash: "bg-c2-wash",
    },
    violet: {
        icon: Server,
        color: "c3",
        badgeVariant: "c3",
        textColor: "text-c3",
        bgColor: "bg-c3-soft",
        borderColor: "border-c3-soft",
        wash: "bg-c3-wash",
    },
};

/** Resolve a Sanity colorVariant, falling back to the primary accent. */
export function styleForVariant(variant: string | undefined): VariantStyle {
    return variantStyles[variant ?? "emerald"] ?? variantStyles.emerald;
}

/** Small-text accent class per slot — AA-safe in light mode. */
export const accentText: Record<AccentSlot, string> = {
    c1: "text-accent",
    c2: "text-c2",
    c3: "text-c3",
};
