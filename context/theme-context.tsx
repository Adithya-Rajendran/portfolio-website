"use client";

import React, { createContext, useContext } from "react";
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
        <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem>
            <ThemeBridge>{children}</ThemeBridge>
        </NextThemesProvider>
    );
}

function ThemeBridge({ children }: { children: React.ReactNode }) {
    const { theme, setTheme } = useNextTheme();

    const toggleTheme = () => {
        setTheme(theme === "dark" ? "light" : "dark");
    };

    return (
        <ThemeContext.Provider
            value={{
                theme: (theme as "light" | "dark") ?? "dark",
                toggleTheme,
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