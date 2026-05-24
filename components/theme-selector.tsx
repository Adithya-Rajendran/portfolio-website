"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Moon, Palette, Sun, Check } from "lucide-react";
import { useTheme } from "@/context/theme-context";
import { themes, type ThemeId } from "@/lib/themes";
import { cn } from "@/lib/utils";

/**
 * Floating bottom-right button that opens a popover for both the
 * appearance (light/dark) and the accent palette. Replaces the older
 * ThemeSwitch which only handled light/dark.
 */
export default function ThemeSelector() {
    const { theme, toggleTheme, accentTheme, setAccentTheme } = useTheme();
    const [open, setOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Close on outside click and Escape.
    useEffect(() => {
        if (!open) return;

        const onClick = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                popoverRef.current?.contains(target) ||
                buttonRef.current?.contains(target)
            ) {
                return;
            }
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };

        document.addEventListener("mousedown", onClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const pickAccent = useCallback(
        (id: ThemeId) => {
            setAccentTheme(id);
        },
        [setAccentTheme],
    );

    return (
        <div className="fixed bottom-5 right-5 z-50">
            {/* Popover */}
            {open && (
                <div
                    ref={popoverRef}
                    role="dialog"
                    aria-label="Theme settings"
                    className="absolute bottom-[calc(100%+0.75rem)] right-0 w-72 glass-strong rounded-2xl p-4 animate-scale-fade-in"
                    style={{ animationDuration: "0.2s" }}
                >
                    {/* Appearance */}
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500 mb-3">
                        Appearance
                    </p>
                    <div
                        role="radiogroup"
                        aria-label="Appearance"
                        className="grid grid-cols-2 gap-2 mb-5"
                    >
                        <AppearanceButton
                            label="Light"
                            Icon={Sun}
                            active={theme === "light"}
                            onClick={() => {
                                if (theme !== "light") toggleTheme();
                            }}
                        />
                        <AppearanceButton
                            label="Dark"
                            Icon={Moon}
                            active={theme === "dark"}
                            onClick={() => {
                                if (theme !== "dark") toggleTheme();
                            }}
                        />
                    </div>

                    {/* Accent palette */}
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500 mb-3">
                        Accent
                    </p>
                    <ul
                        role="radiogroup"
                        aria-label="Accent theme"
                        className="space-y-1.5"
                    >
                        {themes.map((t) => {
                            const active = accentTheme === t.id;
                            return (
                                <li key={t.id}>
                                    <button
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        onClick={() => pickAccent(t.id)}
                                        className={cn(
                                            "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                                            "border border-transparent",
                                            active
                                                ? "bg-slate-100 dark:bg-white/[0.06] border-slate-200/70 dark:border-white/10"
                                                : "hover:bg-slate-50 dark:hover:bg-white/[0.03]",
                                        )}
                                    >
                                        <Swatch colors={t.swatch} />
                                        <span className="flex-1 min-w-0">
                                            <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                                                {t.label}
                                            </span>
                                            <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                                                {t.description}
                                            </span>
                                        </span>
                                        {active && (
                                            <Check
                                                className="w-4 h-4 text-accent flex-shrink-0"
                                                aria-hidden="true"
                                            />
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {/* Trigger button */}
            <button
                ref={buttonRef}
                className="glass text-accent w-[3rem] h-[3rem] rounded-full flex items-center justify-center hover:scale-[1.08] active:scale-95 transition-all glow-hover"
                onClick={() => setOpen((v) => !v)}
                aria-label="Open theme settings"
                aria-expanded={open}
                aria-haspopup="dialog"
            >
                <Palette className="w-4 h-4" aria-hidden="true" />
            </button>
        </div>
    );
}

function AppearanceButton({
    label,
    Icon,
    active,
    onClick,
}: {
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={active}
            onClick={onClick}
            className={cn(
                "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors border",
                active
                    ? "bg-accent-soft border-accent-soft text-accent"
                    : "bg-transparent border-slate-200/70 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]",
            )}
        >
            <Icon className="w-4 h-4" aria-hidden="true" />
            {label}
        </button>
    );
}

function Swatch({ colors }: { colors: [string, string, string] }) {
    return (
        <span
            aria-hidden="true"
            className="flex-shrink-0 w-9 h-9 rounded-full ring-1 ring-black/10 dark:ring-white/15 overflow-hidden flex"
            style={{
                background: `conic-gradient(from 220deg, ${colors[0]} 0deg 120deg, ${colors[1]} 120deg 240deg, ${colors[2]} 240deg 360deg)`,
            }}
        />
    );
}
