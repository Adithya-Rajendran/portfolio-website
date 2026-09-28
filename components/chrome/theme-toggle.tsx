"use client";

import { useSyncExternalStore } from "react";
import { chromeCopy, themeOptions } from "@/lib/copy";
import {
    getServerPref,
    getThemePref,
    setThemePref,
    subscribePrefs,
} from "@/lib/prefs";

/**
 * Void · Manual · Auto, as a radio group (three instances: header, menu
 * sheet, footer; each has its own `name`). The look of the checked option
 * comes from CSS; which option is checked comes from the prefs store, whose
 * server snapshot is `undefined`, so the radios hydrate unchecked and then
 * check the stored choice. Hidden without JavaScript (styles/components.css).
 */
export default function ThemeToggle({
    instance,
}: {
    instance: "head" | "sheet" | "foot";
}) {
    const pref = useSyncExternalStore(
        subscribePrefs,
        getThemePref,
        getServerPref,
    );
    return (
        <fieldset className="theme-toggle">
            <legend>{chromeCopy.themeLegend}</legend>
            {themeOptions.map((option) => {
                const id = `theme-${instance}-${option.value}`;
                return (
                    <span className="theme-toggle__opt" key={option.value}>
                        <input
                            type="radio"
                            name={`theme-${instance}`}
                            id={id}
                            value={option.value}
                            checked={pref === option.value}
                            onChange={() => setThemePref(option.value)}
                        />
                        <label htmlFor={id}>
                            <span className="theme-toggle__t">
                                {"long" in option ? (
                                    <span className="theme-toggle__long">
                                        {option.long}
                                    </span>
                                ) : null}
                                {option.themed}
                            </span>
                            <span className="sr-only">, </span>
                            <span className="theme-toggle__p">
                                {option.plain}
                            </span>
                        </label>
                    </span>
                );
            })}
        </fieldset>
    );
}
