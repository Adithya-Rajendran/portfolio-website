import Link from "next/link";
import { Status } from "@/components/ui/marks";
import { missionsCopy as copy } from "@/lib/copy";
import type { LogEntry } from "@/lib/log-index";
import type { Mission } from "@/lib/missions";
import styles from "./missions.module.css";

/**
 * Table 1, the register (contract §9, G8's columns): every mission by
 * code, with its name, type, status, dates and links. A value that is not
 * set leaves its cell empty. On phones the type and dates columns are
 * hidden and the status moves under the name; the table scrolls inside
 * its region, never the page.
 */
export default function MissionRegister({
    missions,
    entries,
    captionId,
}: {
    missions: readonly Mission[];
    /** Each mission's original Flight Log entry, by mission id. */
    entries: ReadonlyMap<string, LogEntry>;
    captionId: string;
}) {
    return (
        <div
            className={`table-wrap ${styles.register}`}
            role="region"
            aria-labelledby={captionId}
            tabIndex={0}
        >
            <table className="table">
                <caption id={captionId}>
                    <span className="caption__num">{copy.table}</span>
                    {copy.registerCaption}
                </caption>
                <thead>
                    <tr>
                        <th scope="col">{copy.columns.code}</th>
                        <th scope="col">{copy.columns.mission}</th>
                        <th scope="col" className={styles.colType}>
                            {copy.columns.type}
                        </th>
                        <th scope="col" className={styles.colStatus}>
                            {copy.columns.status}
                        </th>
                        <th scope="col" className={styles.colDates}>
                            {copy.columns.dates}
                        </th>
                        <th scope="col">{copy.columns.links}</th>
                    </tr>
                </thead>
                <tbody>
                    {missions.map((mission) => {
                        const entry = entries.get(mission.id);
                        return (
                            <tr key={mission.id}>
                                <td className={`data ${styles.regCode}`}>
                                    {mission.designation}
                                </td>
                                <th scope="row" className={styles.regMission}>
                                    <Link
                                        className={styles.regName}
                                        href={mission.href}
                                    >
                                        {mission.name}
                                    </Link>
                                    <span className={styles.regTitle}>
                                        {mission.title}
                                    </span>
                                    <span className={styles.regStatusSm}>
                                        <Status value={mission.statusValue}>
                                            {mission.statusLabel}
                                        </Status>
                                    </span>
                                </th>
                                <td className={styles.colType}>
                                    <span className={styles.regType}>
                                        {mission.types.join(" · ")}
                                    </span>
                                </td>
                                <td className={styles.colStatus}>
                                    <Status value={mission.statusValue}>
                                        {mission.statusLabel}
                                    </Status>
                                </td>
                                <td className={`data ${styles.colDates}`}>
                                    {mission.dates}
                                </td>
                                <td>
                                    <ul className={styles.regLinks} role="list">
                                        <li>
                                            <Link href={mission.href}>
                                                {copy.file}
                                                <span className="sr-only">
                                                    {" "}
                                                    · {mission.name}
                                                </span>
                                            </Link>
                                        </li>
                                        {entry ? (
                                            <li>
                                                <Link
                                                    href={`/blog/${entry.slug}`}
                                                >
                                                    {entry.designation}
                                                    <span className="sr-only">
                                                        {" "}
                                                        · {entry.title}
                                                    </span>
                                                </Link>
                                            </li>
                                        ) : null}
                                        {mission.links.map((link) => (
                                            <li key={link.id}>
                                                <a
                                                    href={link.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    {link.short}
                                                    {link.short !==
                                                    link.label ? (
                                                        <span className="sr-only">
                                                            {" "}
                                                            · {link.label}
                                                        </span>
                                                    ) : null}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
