import Link from "next/link";
import { Rev } from "@/components/ui/marks";
import { postCopy as copy } from "@/lib/copy";
import { formatMissionDesignation } from "@/lib/designations";
import { entryInside, wordsLabel, type EntryCounts } from "@/lib/entry-counts";
import type { PostHeading } from "@/lib/headings";
import styles from "./post.module.css";

/**
 * "In this entry" (G1): the entry's record (LOG number, filed, revised,
 * length, what it holds, the mission it belongs to) and its contents. On a
 * wide screen it is the sticky rail beside the text (`PostRail`); on a
 * phone the same record sits in a closed disclosure above the text
 * (`PostBox`), so the first paragraph stays in the first screen. CSS shows
 * one of the two; both are server-rendered, so they work without
 * JavaScript. The contents are `nav aria-label="On this page"`, never an
 * `aside` inside `main`. PostReader marks the current section.
 */

export interface EntryRecord {
    designation?: string;
    /** How many entries the log holds: "of 003". */
    total: number;
    filed?: string;
    revised?: string | null;
    words: number;
    readMinutes: number | null;
    counts: EntryCounts;
    missions: { slug: string; designation: number; title: string }[];
}

function Record({ record }: { record: EntryRecord }) {
    const inside = entryInside(record.counts);
    const length = [
        record.words > 0 ? wordsLabel(record.words) : null,
        record.readMinutes ? copy.record.minutes(record.readMinutes) : null,
    ].filter(Boolean);
    return (
        <dl className={styles.record}>
            {record.designation ? (
                <div>
                    <dt>{copy.record.entry}</dt>
                    <dd className="data">
                        {record.designation}{" "}
                        <span className={styles.recordOf}>
                            {copy.record.of}{" "}
                            {String(record.total).padStart(3, "0")}
                        </span>
                    </dd>
                </div>
            ) : null}
            {record.filed ? (
                <div>
                    <dt>{copy.record.filed}</dt>
                    <dd>
                        <time className="data" dateTime={record.filed}>
                            {record.filed}
                        </time>
                    </dd>
                </div>
            ) : null}
            {record.revised ? (
                <div>
                    <dt>{copy.record.revised}</dt>
                    <dd>
                        <Rev date={record.revised} />
                    </dd>
                </div>
            ) : null}
            {length.length > 0 ? (
                <div>
                    <dt>{copy.record.length}</dt>
                    <dd>{length.join(" · ")}</dd>
                </div>
            ) : null}
            {inside.length > 0 ? (
                <div>
                    <dt>{copy.record.inside}</dt>
                    <dd>{inside.join(" · ")}</dd>
                </div>
            ) : null}
            {record.missions.length > 0 ? (
                <div>
                    <dt>
                        {record.missions.length === 1
                            ? copy.record.mission
                            : copy.record.missions}
                    </dt>
                    <dd className={styles.recordMissions}>
                        {record.missions.map((mission) => (
                            <Link
                                key={mission.slug}
                                className={styles.recordMission}
                                href={`/portfolio/${mission.slug}`}
                            >
                                <span className="data">
                                    {formatMissionDesignation(
                                        mission.designation,
                                    )}
                                </span>{" "}
                                {mission.title}
                            </Link>
                        ))}
                    </dd>
                </div>
            ) : null}
        </dl>
    );
}

function Contents({ headings }: { headings: readonly PostHeading[] }) {
    if (!headings.length) return null;
    return (
        <nav
            className={styles.contents}
            aria-label={copy.contentsLabel}
            data-contents
        >
            <p className={`label label--ink ${styles.contentsTitle}`}>
                {copy.contents}
            </p>
            <ol className={styles.contentsList} role="list">
                {headings.map((heading) => (
                    <li key={heading.key}>
                        <a href={`#${heading.id}`}>{heading.text}</a>
                    </li>
                ))}
            </ol>
        </nav>
    );
}

/** The sticky rail beside the text (≥ 960px). */
export function PostRail({
    record,
    headings,
    className,
}: {
    record: EntryRecord;
    headings: readonly PostHeading[];
    className?: string;
}) {
    return (
        <div className={className} data-print="hide">
            <p className={`label label--ink ${styles.railTitle}`}>
                {copy.record.title}
            </p>
            <Record record={record} />
            <Contents headings={headings} />
        </div>
    );
}

/** The same record as a closed disclosure above the text (< 960px). */
export function PostBox({
    record,
    headings,
    className,
}: {
    record: EntryRecord;
    headings: readonly PostHeading[];
    className?: string;
}) {
    const summary = [
        record.counts.sections > 0 ? entryInside(record.counts)[0] : null,
        record.readMinutes ? copy.record.minutes(record.readMinutes) : null,
    ].filter(Boolean);
    return (
        <details className={className} data-print="hide" data-entry-box>
            <summary className={styles.boxSummary}>
                <span className="label label--ink">{copy.record.title}</span>
                {summary.length > 0 ? (
                    <span className={`data ${styles.boxCount}`}>
                        {summary.join(" · ")}
                    </span>
                ) : null}
            </summary>
            <div className={styles.boxBody}>
                <Record record={record} />
                <Contents headings={headings} />
            </div>
        </details>
    );
}
