import Link from "next/link";
import { logCopy as copy } from "@/lib/copy";
import type { TransmissionsChart } from "@/lib/transmissions";
import styles from "./transmissions.module.css";

/**
 * Fig. 1 · Entries by date (Deep Field's chart on the Flight Log index):
 * every entry as a mark on a real time axis, height = reading time, the
 * newest in the accent. The caption says what it shows; the plot is a
 * picture of the index below, so it is hidden from assistive technology
 * and its marks are pointer targets only (the rows are the keyboard path).
 * Hovering a mark names its entry. Ported from the mockup's writing.css
 * and writing.js (`.log-strip`).
 */
export default function Transmissions({
    chart,
    className,
}: {
    chart: TransmissionsChart;
    className?: string;
}) {
    const { chart: text } = copy;
    return (
        <figure
            className={
                className ? `${styles.strip} ${className}` : styles.strip
            }
            aria-labelledby="transmissions-caption"
            data-print="hide"
        >
            <figcaption className={styles.legend} id="transmissions-caption">
                <span className="caption__num">{text.num}</span>
                <span>{text.what(chart.from)}</span>
                <span className={`label ${styles.key}`} aria-hidden="true">
                    {text.key}
                </span>
            </figcaption>
            <div className={styles.plot} aria-hidden="true">
                {chart.ticks.map((tick) => (
                    <span
                        key={tick.label + tick.x}
                        className={[
                            styles.tick,
                            tick.year && styles.tickYear,
                            tick.minor && styles.tickMinor,
                        ]
                            .filter(Boolean)
                            .join(" ")}
                        style={{ "--x": `${tick.x}%` } as React.CSSProperties}
                    >
                        <b>{tick.label}</b>
                    </span>
                ))}
                {chart.marks.map((mark) => (
                    <Link
                        key={mark.slug}
                        href={`/blog/${mark.slug}`}
                        tabIndex={-1}
                        // The row below links to the same entry and
                        // prefetches it; the marks would prefetch every
                        // entry at once.
                        prefetch={false}
                        className={[
                            styles.mark,
                            mark.latest && styles.latest,
                            mark.labelLeft && styles.left,
                            mark.tipLeft && styles.tipLeft,
                        ]
                            .filter(Boolean)
                            .join(" ")}
                        style={
                            {
                                "--x": `${mark.x}%`,
                                "--h": mark.h,
                            } as React.CSSProperties
                        }
                    >
                        <span className={styles.num}>{mark.number}</span>
                        <span className={styles.tip}>
                            <b>{mark.designation}</b> {mark.title}
                            {mark.readMinutes
                                ? ` · ${copy.read(mark.readMinutes)}`
                                : ""}
                        </span>
                    </Link>
                ))}
                <span
                    className={styles.now}
                    style={{ "--x": `${chart.now}%` } as React.CSSProperties}
                >
                    <b>{text.now}</b>
                </span>
            </div>
        </figure>
    );
}
