"use client";

import { Icon } from "@/components/ui/icon";
import { chromeCopy } from "@/lib/copy";
import { setThemePref } from "@/lib/prefs";

/**
 * The header's theme control (contract §6): one 44px button that switches
 * Void ↔ Flight Manual. It names the theme it switches to, and CSS picks
 * that name from `html[data-theme]`, so under Auto it follows the theme on
 * screen and nothing re-renders or mismatches on hydration. Auto stays one
 * click away in the footer and the menu sheet (ThemeChoice). Hidden
 * without JavaScript, like every theme control.
 */
export default function ThemeSwitch() {
    return (
        <button
            type="button"
            className="theme-switch"
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
