"use client";

import { useTheme } from "@/context/theme-context";
import React from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeSwitch() {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            className="glass fixed bottom-5 right-5 z-50 text-indigo-600 w-[3rem] h-[3rem] rounded-full flex items-center justify-center hover:scale-[1.08] active:scale-95 transition-all glow-hover dark:text-indigo-300"
            onClick={toggleTheme}
            aria-label="Toggle Theme"
            aria-pressed={theme === "dark"}
        >
            {theme === "light" ? (
                <Sun className="w-4 h-4" aria-hidden="true" />
            ) : (
                <Moon className="w-4 h-4" aria-hidden="true" />
            )}
        </button>
    );
}
