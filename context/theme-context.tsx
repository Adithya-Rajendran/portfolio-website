"use client";

import React, { createContext, useCallback, useContext } from "react";
import {
    ThemeProvider as NextThemesProvider,
    useTheme as useNextTheme,
} from "next-themes";

type ThemeContextType = {
    theme: "light" | "dark";
    toggleTheme: () => void;
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
    const resolvedTheme = theme === "light" ? "light" : "dark";
    const toggleTheme = useCallback(() => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
    }, [resolvedTheme, setTheme]);

    return (
        <ThemeContext.Provider value={{ theme: resolvedTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within a ThemeContextProvider");
    }
    return context;
}
