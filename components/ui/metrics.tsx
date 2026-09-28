import type { CSSProperties } from "react";
import { splitUnit } from "@/lib/metrics";

/**
 * Stats set like a vehicle page (contract §4 and §11, the mockup's
 * site.css 4.9 `dl.metrics`): each value in Jost 300 with tabular figures
 * and a smaller unit, its label under it, a meaningful hairline on top.
 * Real values only, at most four, two across on phones. The label comes
 * first in the markup, so it is read before the value.
 */

export interface MetricItem {
    /** Stable React key. */
    id: string;
    label: string;
    value: string;
}

export default function Metrics({
    items,
    columns = 4,
    size = "md",
    className,
}: {
    items: readonly MetricItem[];
    /** Across from 600px; always two on phones. */
    columns?: 2 | 3 | 4;
    /** `lg` on a mission head, `sm` on a tile. */
    size?: "sm" | "md" | "lg";
    className?: string;
}) {
    const shown = items.slice(0, 4);
    if (!shown.length) return null;
    const classes = ["metrics", size !== "md" && `metrics--${size}`, className]
        .filter(Boolean)
        .join(" ");
    return (
        <dl
            className={classes}
            style={
                {
                    "--metric-cols": Math.min(columns, shown.length),
                } as CSSProperties
            }
        >
            {shown.map((item) => {
                const { amount, unit } = splitUnit(item.value);
                return (
                    <div className="metric" key={item.id}>
                        <dt>{item.label}</dt>
                        <dd>
                            {amount}
                            {unit ? (
                                <span className="metric__unit"> {unit}</span>
                            ) : null}
                        </dd>
                    </div>
                );
            })}
        </dl>
    );
}
