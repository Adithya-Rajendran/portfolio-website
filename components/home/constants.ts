import { Code, ShieldCheck, Server } from "lucide-react";
import React from "react";

export const variantIcons: Record<string, React.ReactElement> = {
    emerald: React.createElement(Code, { className: "w-5 h-5" }),
    cyan: React.createElement(ShieldCheck, { className: "w-5 h-5" }),
    violet: React.createElement(Server, { className: "w-5 h-5" }),
};

export const variantStyles: Record<
    string,
    {
        accentColor: string;
        bgColor: string;
        iconBorder: string;
        badgeVariant: "cyber" | "cyan" | "violet";
    }
> = {
    emerald: {
        accentColor: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-50 dark:bg-emerald-500/10",
        iconBorder: "border-emerald-200 dark:border-emerald-500/20",
        badgeVariant: "cyber",
    },
    cyan: {
        accentColor: "text-cyan-600 dark:text-cyan-400",
        bgColor: "bg-cyan-50 dark:bg-cyan-500/10",
        iconBorder: "border-cyan-200 dark:border-cyan-500/20",
        badgeVariant: "cyan",
    },
    violet: {
        accentColor: "text-violet-600 dark:text-violet-400",
        bgColor: "bg-violet-50 dark:bg-violet-500/10",
        iconBorder: "border-violet-200 dark:border-violet-500/20",
        badgeVariant: "violet",
    },
};
