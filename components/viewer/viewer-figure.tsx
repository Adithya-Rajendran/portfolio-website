import Plate from "@/components/ui/plate";
import type { Callout } from "@/lib/missions";
import type { ProjectModel } from "@/lib/sanity-client";
import styles from "./viewer.module.css";

/**
 * The 3D viewer's server part (G5, plan §2.5.4): until the viewer island
 * lands (PR 15), the model's poster photograph is the figure, as a plate
 * with no caption (the model's title is not one the owner wrote, and the
 * head's h1 names the project; as on home's and /portfolio's stage); the
 * photograph's own alt text describes it. The model's description (`model.alt`) describes the
 * drawing, so the island renders it once the drawing is mounted.
 * `data-viewer` marks the slot the island will mount in; nothing here
 * pretends to be a control.
 */
export default function ViewerFigure({
    model,
    className,
    priority = false,
}: {
    model: ProjectModel;
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
                ratio="4 / 5"
                focus="50% 40%"
                sizes="(min-width: 60rem) 36vw, 100vw"
                priority={priority}
            />
        </div>
    );
}

/**
 * The model's callouts as plain hairline rows (G5): the part and what it
 * does. Until the drawing lands (PR 15) there is nothing to number or
 * point at, so the rows carry no balloon and no link; the write-up is
 * linked once, in the head.
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
        <ul
            className={styles.callouts}
            aria-labelledby={labelledBy}
            role="list"
        >
            {callouts.map((callout) => (
                <li key={callout.id} className={styles.callout}>
                    <p className={styles.calloutTitle}>{callout.title}</p>
                    {callout.body ? (
                        <p className={styles.calloutText}>{callout.body}</p>
                    ) : null}
                </li>
            ))}
        </ul>
    );
}
