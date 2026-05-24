import { Code, ShieldCheck, Server } from "lucide-react";
import React from "react";

export const variantIcons: Record<string, React.ReactElement> = {
    emerald: React.createElement(Code, { className: "w-5 h-5" }),
    cyan: React.createElement(ShieldCheck, { className: "w-5 h-5" }),
    violet: React.createElement(Server, { className: "w-5 h-5" }),
};

/**
 * Sanity content uses three colorVariant keys (emerald/cyan/violet)
 * inherited from the original palette. They now map onto the three
 * theme accent positions (c1/c2/c3) so existing content adapts to
 * whichever accent theme the visitor has selected.
 */
export const variantStyles: Record<
    string,
    {
        textColor: string;
        bgColor: string;
        borderColor: string;
        wash: string;
        badgeVariant: "c1" | "c2" | "c3";
    }
> = {
    emerald: {
        textColor: "text-accent",
        bgColor: "bg-c1-soft",
        borderColor: "border-c1-soft",
        wash: "bg-c1-wash",
        badgeVariant: "c1",
    },
    cyan: {
        textColor: "text-c2",
        bgColor: "bg-c2-soft",
        borderColor: "border-c2-soft",
        wash: "bg-c2-wash",
        badgeVariant: "c2",
    },
    violet: {
        textColor: "text-c3",
        bgColor: "bg-c3-soft",
        borderColor: "border-c3-soft",
        wash: "bg-c3-wash",
        badgeVariant: "c3",
    },
};
