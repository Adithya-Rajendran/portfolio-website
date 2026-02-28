"use client";

import { useTheme } from "@/context/theme-context";
import React from "react";
import { BsMoon, BsSun } from "react-icons/bs";

export default function ThemeSwitch() {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            className="fixed bottom-5 right-5 bg-white text-emerald-700 w-[3rem] h-[3rem] backdrop-blur-[0.5rem] border border-emerald-300 shadow-lg shadow-emerald-200/30 rounded-full flex items-center justify-center hover:scale-[1.15] active:scale-105 transition-all hover:bg-emerald-50 dark:bg-slate-800 dark:text-emerald-400 dark:border-emerald-500/30 dark:shadow-emerald-500/10 dark:hover:bg-slate-700"
            onClick={toggleTheme}
            aria-label="Toggle Theme"
        >
            {theme === "light" ? (
                <BsSun aria-hidden="true" />
            ) : (
                <BsMoon aria-hidden="true" />
            )}
        </button>
    );
}
