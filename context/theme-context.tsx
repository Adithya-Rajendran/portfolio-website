"use client";

import React, {
    createContext,
    useCallback,
    useContext,
    useSyncExternalStore,
} from "react";
import {
    ThemeProvider as NextThemesProvider,
    useTheme as useNextTheme,
} from "next-themes";
import { DEFAULT_THEME, isThemeId, type ThemeId } from "@/lib/themes";

const ACCENT_STORAGE_KEY = "accent-theme";

/* ─── External store for the accent theme ────────────────────────────
   We keep the source of truth in localStorage + the <html data-theme>
   attribute (so a no-FOUC inline script can hydrate it). React reads
   the current value via useSyncExternalStore; writes notify subscribers
   so every consumer re-renders.
   ─────────────────────────────────────────────────────────────────── */

let listeners: Array<() => void> = [];
function subscribe(callback: () => void) {
    listeners.push(callback);
    return () => {
        listeners = listeners.filter((l) => l !== callback);
    };
}
function notify() {
    listeners.forEach((l) => l());
}

function getAccentSnapshot(): ThemeId {
    try {
        const stored = window.localStorage.getItem(ACCENT_STORAGE_KEY);
        if (isThemeId(stored)) return stored;
        const fromDom = document.documentElement.dataset.theme;
        if (isThemeId(fromDom)) return fromDom;
    } catch {
        /* fall through to default */
    }
    return DEFAULT_THEME;
}

function getServerAccentSnapshot(): ThemeId {
    return DEFAULT_THEME;
}

function writeAccent(id: ThemeId) {
    document.documentElement.dataset.theme = id;
    try {
        window.localStorage.setItem(ACCENT_STORAGE_KEY, id);
    } catch {
        /* swallow — UI still updates via the notify below */
    }
    notify();
}

type ThemeContextType = {
    /** Light/dark mode (managed by next-themes). */
    theme: "light" | "dark";
    toggleTheme: () => void;
    /** Active accent theme (palette). */
    accentTheme: ThemeId;
    setAccentTheme: (id: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export default function ThemeContextProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <NextThemesProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
        >
            <ThemeBridge>{children}</ThemeBridge>
        </NextThemesProvider>
    );
}

function ThemeBridge({ children }: { children: React.ReactNode }) {
    const { theme, setTheme } = useNextTheme();
    const accentTheme = useSyncExternalStore(
        subscribe,
        getAccentSnapshot,
        getServerAccentSnapshot,
    );

    const setAccentTheme = useCallback((id: ThemeId) => {
        writeAccent(id);
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(theme === "dark" ? "light" : "dark");
    }, [theme, setTheme]);

    return (
        <ThemeContext.Provider
            value={{
                theme: theme === "light" ? "light" : "dark",
                toggleTheme,
                accentTheme,
                setAccentTheme,
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);

    if (context === null) {
        throw new Error("useTheme must be used within a ThemeContextProvider");
    }

    return context;
}
