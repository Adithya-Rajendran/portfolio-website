"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/icon";
import { chromeCopy } from "@/lib/copy";
import { setThemePref } from "@/lib/prefs";

/** The theme on screen, from `html[data-theme]`, whoever changed it. */
function subscribeTheme(callback: () => void): () => void {
    const observer = new MutationObserver(callback);
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
}

function getTheme(): string {
    return document.documentElement.dataset.theme ?? "void";
}

function getServerTheme(): undefined {
    return undefined;
}

/**
 * The header's theme control (contract §6): one 44px button that switches
 * Void ↔ Flight Manual. It names the theme it switches to, and CSS picks
 * that name from `html[data-theme]`, so under Auto it follows the theme on
 * screen and nothing re-renders or mismatches on hydration. Once hydrated
 * it also carries the same words as a hover title for mouse users. Auto
 * (System) is the menu sheet's choice (ThemeChoice, below 960px); the
 * footer has no theme control. Hidden without JavaScript, like every
 * theme control.
 */
export default function ThemeSwitch() {
    const theme = useSyncExternalStore(
        subscribeTheme,
        getTheme,
        getServerTheme,
    );
    const title =
        theme === undefined
            ? undefined
            : theme === "manual"
              ? chromeCopy.toDark
              : chromeCopy.toLight;
    return (
        <button
            type="button"
            className="theme-switch"
            title={title}
            onClick={() =>
                setThemePref(
                    document.documentElement.dataset.theme === "manual"
                        ? "void"
                        : "manual",
                )
            }
        >
            <Icon name="theme" />
            <span className="theme-switch__to-light sr-only">
                {chromeCopy.toLight}
            </span>
            <span className="theme-switch__to-dark sr-only">
                {chromeCopy.toDark}
            </span>
        </button>
    );
}
