import { Code, ShieldCheck, Server } from "lucide-react";
import React from "react";

export const variantIcons: Record<string, React.ReactElement> = {
    emerald: React.createElement(Code, { className: "w-5 h-5" }),
    cyan: React.createElement(ShieldCheck, { className: "w-5 h-5" }),
    violet: React.createElement(Server, { className: "w-5 h-5" }),
};

/**
 * Sanity content uses three colorVariant keys (emerald/cyan/violet)
 * from the original palette. They now map onto the indigo/sky/violet
 * accents of the Surface Glass theme so existing content keeps working.
 */
export const variantStyles: Record<
    string,
    {
        accentColor: string;
        bgColor: string;
        iconBorder: string;
        badgeVariant: "indigo" | "sky" | "violet";
        gradientFrom: string;
        gradientTo: string;
    }
> = {
    emerald: {
        accentColor: "text-indigo-600 dark:text-indigo-300",
        bgColor: "bg-indigo-50 dark:bg-indigo-500/10",
        iconBorder: "border-indigo-200 dark:border-indigo-400/20",
        badgeVariant: "indigo",
        gradientFrom: "from-indigo-500/15",
        gradientTo: "to-indigo-500/0",
    },
    cyan: {
        accentColor: "text-sky-600 dark:text-sky-300",
        bgColor: "bg-sky-50 dark:bg-sky-500/10",
        iconBorder: "border-sky-200 dark:border-sky-400/20",
        badgeVariant: "sky",
        gradientFrom: "from-sky-500/15",
        gradientTo: "to-sky-500/0",
    },
    violet: {
        accentColor: "text-violet-600 dark:text-violet-300",
        bgColor: "bg-violet-50 dark:bg-violet-500/10",
        iconBorder: "border-violet-200 dark:border-violet-400/20",
        badgeVariant: "violet",
        gradientFrom: "from-violet-500/15",
        gradientTo: "to-violet-500/0",
    },
};
