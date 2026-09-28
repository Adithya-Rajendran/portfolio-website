"use client";

import { Icon } from "@/components/ui/icon";
import { chromeCopy } from "@/lib/copy";
import { getMotionPref, setMotionPref } from "@/lib/prefs";

/**
 * Hold drift / Resume drift (WCAG 2.2.2), in the footer and the menu
 * sheet. One button whose label names the action; CSS picks the label
 * from `html[data-motion]`, so nothing re-renders. Under the OS
 * reduce-motion setting a plain note replaces it. Hidden without
 * JavaScript, when nothing moves anyway (no `data-motion`).
 */
export default function MotionToggle({ className }: { className?: string }) {
    return (
        <span className={className ? `motion-ctl ${className}` : "motion-ctl"}>
            <button
                type="button"
                className="btn btn--sm motion-toggle"
                onClick={() =>
                    setMotionPref(
                        getMotionPref() === "reduced" ? "full" : "reduced",
                    )
                }
            >
                <Icon name="pause" className="motion-toggle__on" />
                <Icon name="play" className="motion-toggle__off" />
                <span className="motion-toggle__on">
                    {chromeCopy.holdDrift}
                </span>
                <span className="motion-toggle__off">
                    {chromeCopy.resumeDrift}
                </span>
            </button>
            <span className="motion-ctl__os label">
                {chromeCopy.motionHeldByOs}
            </span>
        </span>
    );
}
