import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import Plate from "@/components/ui/plate";
import type { Callout } from "@/lib/missions";
import type { ProjectModel } from "@/lib/sanity-client";
import styles from "./viewer.module.css";

/**
 * The 3D viewer's server part (G5, plan §2.5.4): until the viewer island
 * lands (PR 15), the model's poster photograph is the figure, as a plate
 * with the model's title for its caption, and the model's text description
 * is its long description. `data-viewer` marks the slot the island will
 * mount in; nothing here pretends to be a control.
 */
export default function ViewerFigure({
    model,
    designation,
    className,
    priority = false,
}: {
    model: ProjectModel;
    designation: string;
    className?: string;
    priority?: boolean;
}) {
    if (!model.poster?.asset) return null;
    return (
        <div
            className={
                className ? `${styles.figure} ${className}` : styles.figure
            }
            data-viewer={model.procedural ?? model.kind}
        >
            <Plate
                image={model.poster}
                label="Pl. I"
                tag={designation}
                caption={model.title?.trim() || null}
                ratio="4 / 5"
                focus="50% 40%"
                sizes="(min-width: 60rem) 36vw, 100vw"
                priority={priority}
            />
            {model.alt?.trim() ? (
                <p className="sr-only">{model.alt.trim()}</p>
            ) : null}
        </div>
    );
}

/**
 * The model's callouts as numbered rows (G5): the balloon's numeral, the
 * part and what it does, each row linked to the section that explains it
 * (in a Flight Log entry or in this file's write-up). The same list labels
 * the balloons once the drawing is live.
 */
export function ViewerCallouts({
    callouts,
    labelledBy,
}: {
    callouts: readonly Callout[];
    labelledBy: string;
}) {
    if (!callouts.length) return null;
    return (
        <ol
            className={styles.callouts}
            aria-labelledby={labelledBy}
            role="list"
        >
            {callouts.map((callout) => (
                <li
                    key={callout.id}
                    className={
                        callout.href
                            ? `${styles.callout} ${styles.calloutLinked}`
                            : styles.callout
                    }
                >
                    <span className={styles.balloon} aria-hidden="true">
                        {callout.label}
                    </span>
                    <div className={styles.calloutBody}>
                        <p className={styles.calloutTitle}>
                            {callout.href ? (
                                <Link className="stretch" href={callout.href}>
                                    {callout.title}
                                    {callout.entry ? (
                                        <span className="sr-only">
                                            {" "}
                                            · {callout.entry}
                                        </span>
                                    ) : null}
                                </Link>
                            ) : (
                                callout.title
                            )}
                        </p>
                        {callout.body ? (
                            <p className={styles.calloutText}>{callout.body}</p>
                        ) : null}
                    </div>
                    {callout.href ? (
                        <span className={styles.calloutRef} aria-hidden="true">
                            {callout.entry ?? ""}
                            <Icon name="arrow" />
                        </span>
                    ) : null}
                </li>
            ))}
        </ol>
    );
}
