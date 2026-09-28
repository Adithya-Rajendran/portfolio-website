"use client";

import { useSyncExternalStore } from "react";
import Segmented from "@/components/ui/segmented";
import { chromeCopy, themeOptions } from "@/lib/copy";
import {
    getServerPref,
    getThemePref,
    setThemePref,
    subscribePrefs,
} from "@/lib/prefs";
import type { ThemePref } from "@/lib/theme-boot";

/**
 * Void · Manual · Auto as a `Segmented` group (contract §6), in the footer
 * and the menu sheet; each instance has its own `name`. Which option is
 * checked comes from the prefs store, whose server snapshot is
 * `undefined`, so the radios hydrate unchecked and then check the stored
 * choice. Hidden without JavaScript (styles/components.css).
 */
export default function ThemeChoice({ instance }: { instance: string }) {
    const pref = useSyncExternalStore(
        subscribePrefs,
        getThemePref,
        getServerPref,
    );
    return (
        <Segmented
            className="theme-choice"
            legend={chromeCopy.themeLegend}
            name={`theme-${instance}`}
            options={themeOptions}
            value={pref ?? ""}
            onChange={(value) => setThemePref(value as ThemePref)}
        />
    );
}
