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
 * Dark · Light · System (the values `void` · `manual` · `auto`) as a
 * `Segmented` group (contract §6), in the menu sheet (below 960px; from
 * 960px the header's switch). Which option is checked comes from the
 * prefs store, whose server snapshot is `undefined`, so the radios
 * hydrate unchecked and then check the stored choice. Hidden without
 * JavaScript (styles/components.css).
 */
export default function ThemeChoice() {
    const pref = useSyncExternalStore(
        subscribePrefs,
        getThemePref,
        getServerPref,
    );
    return (
        <Segmented
            className="theme-choice"
            legend={chromeCopy.themeLegend}
            name="theme"
            options={themeOptions}
            value={pref ?? ""}
            onChange={(value) => setThemePref(value as ThemePref)}
        />
    );
}
