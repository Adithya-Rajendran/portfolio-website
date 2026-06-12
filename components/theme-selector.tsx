"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Moon, Palette, Sun, Check } from "lucide-react";
import { useTheme } from "@/context/theme-context";
import { themes, type ThemeId } from "@/lib/themes";
import { cn } from "@/lib/utils";

/**
 * Bottom-right floating button that opens a Samsung One UI-style
 * "bottom sheet" popover for appearance + accent. The popover uses
 * grouped list patterns for both controls.
 */
export default function ThemeSelector() {
    const { theme, toggleTheme, accentTheme, setAccentTheme } = useTheme();
    const [open, setOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open) return;

        // Move focus into the sheet; restore it to the trigger on close.
        const trigger = buttonRef.current;
        popoverRef.current?.querySelector<HTMLButtonElement>("button")?.focus();

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
            trigger?.focus();
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
            {open && (
                <div
                    ref={popoverRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Theme settings"
                    className="absolute bottom-[calc(100%+0.75rem)] right-0 w-80 os-card-raised rounded-card-lg p-5 animate-scale-fade-in"
                    style={{ animationDuration: "0.2s" }}
                >
                    {/* Pill drag handle — pure ornament that signals
                        this is a bottom-sheet, One UI style */}
                    <div
                        aria-hidden
                        className="mx-auto mb-4 h-1 w-9 rounded-full bg-slate-300/80 dark:bg-white/15"
                    />

                    <p className="px-1 mb-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Appearance
                    </p>
                    <div
                        role="group"
                        aria-label="Appearance"
                        className="grid grid-cols-2 gap-2 p-1 bg-slate-100/70 dark:bg-white/[0.04] rounded-2xl mb-5"
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

                    <p className="px-1 mb-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Accent
                    </p>
                    <ul
                        role="group"
                        aria-label="Accent theme"
                        className="os-card-flat rounded-2xl overflow-hidden divide-y divide-slate-200/60 dark:divide-white/[0.06]"
                    >
                        {themes.map((t) => {
                            const active = accentTheme === t.id;
                            return (
                                <li key={t.id}>
                                    <button
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => pickAccent(t.id)}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-100/60 dark:hover:bg-white/[0.03]"
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
                                        {active ? (
                                            <Check
                                                className="w-4 h-4 text-accent flex-shrink-0"
                                                aria-hidden
                                            />
                                        ) : (
                                            <span className="w-4 h-4 flex-shrink-0" />
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            <button
                ref={buttonRef}
                className="os-card text-accent w-[3rem] h-[3rem] rounded-full flex items-center justify-center hover:scale-[1.06] active:scale-95 transition-all os-hover"
                onClick={() => setOpen((v) => !v)}
                aria-label="Open theme settings"
                aria-expanded={open}
                aria-haspopup="dialog"
            >
                <Palette className="w-4 h-4" aria-hidden />
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
            aria-pressed={active}
            onClick={onClick}
            className={cn(
                "flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all os-press",
                active
                    ? "bg-white dark:bg-white/[0.1] text-accent shadow-sm"
                    : "bg-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white",
            )}
        >
            <Icon className="w-4 h-4" aria-hidden />
            {label}
        </button>
    );
}

function Swatch({ colors }: { colors: [string, string, string] }) {
    return (
        <span
            aria-hidden
            className="flex-shrink-0 w-10 h-10 rounded-squircle ring-1 ring-black/10 dark:ring-white/15 overflow-hidden"
            style={{
                background: `conic-gradient(from 220deg, ${colors[0]} 0deg 120deg, ${colors[1]} 120deg 240deg, ${colors[2]} 240deg 360deg)`,
            }}
        />
    );
}
