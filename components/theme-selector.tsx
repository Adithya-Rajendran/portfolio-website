"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/theme-context";
import { cn } from "@/lib/utils";

/**
 * The site has one visual identity. Appearance changes only the canvas;
 * emerald remains the accent in both modes.
 */
export default function ThemeSelector({
    variant = "toggle",
    className,
}: {
    variant?: "toggle" | "inline" | "popover";
    className?: string;
}) {
    const { toggleTheme } = useTheme();

    if (variant === "inline") {
        return (
            <section aria-label="Appearance" className={className}>
                <p className="mb-2 px-1 font-term text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Appearance
                </p>
                <button
                    type="button"
                    onClick={toggleTheme}
                    className="os-press flex min-h-11 w-full items-center justify-between rounded-xl border border-slate-200/70 bg-white/55 px-3.5 text-sm font-medium text-slate-700 transition-colors hover:border-accent-soft hover:text-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[rgb(var(--c1))] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
                    aria-label="Toggle color theme"
                >
                    <span className="inline-flex items-center gap-2.5 dark:hidden">
                        <Moon className="size-4" aria-hidden />
                        Dark mode
                    </span>
                    <span className="hidden items-center gap-2.5 dark:inline-flex">
                        <Sun className="size-4" aria-hidden />
                        Light mode
                    </span>
                    <span className="font-term text-[0.68rem] text-slate-500 dark:text-slate-400">
                        switch
                    </span>
                </button>
            </section>
        );
    }

    return (
        <button
            type="button"
            onClick={toggleTheme}
            className={cn(
                "os-press grid size-11 place-items-center rounded-full border border-slate-200/70 bg-white/55 text-slate-700 transition-colors hover:border-accent-soft hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c1))] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200",
                className,
            )}
            aria-label="Toggle color theme"
            title="Toggle color theme"
        >
            <Moon className="size-[1.05rem] dark:hidden" aria-hidden />
            <Sun className="hidden size-[1.05rem] dark:block" aria-hidden />
        </button>
    );
}
