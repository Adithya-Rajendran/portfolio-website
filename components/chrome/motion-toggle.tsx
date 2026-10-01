"use client";

import { Icon } from "@/components/ui/icon";
import { chromeCopy } from "@/lib/copy";
import { getMotionPref, setMotionPref } from "@/lib/prefs";

/**
 * Pause motion / Resume motion (WCAG 2.2.2), in the footer and the home
 * hero (beside the drifting starfield): an unboxed control, the icon and
 * its label in the controls' voice, on a 44px target. One button whose
 * label names the action; CSS picks the label from `html[data-motion]`,
 * so nothing re-renders. Under the OS reduce-motion setting, and without
 * JavaScript (no `data-motion`), nothing moves, so it shows nothing.
 */
export default function MotionToggle({ className }: { className?: string }) {
    return (
        <span className={className ? `motion-ctl ${className}` : "motion-ctl"}>
            <button
                type="button"
                className="motion-toggle"
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
        </span>
    );
}
