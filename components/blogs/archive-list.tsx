"use client";

import { useId, useState } from "react";
import LogIndex from "@/components/blogs/log-index";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { logCopy } from "@/lib/copy";
import { entryCount, type LogEntry } from "@/lib/log-index";
import styles from "./archive-list.module.css";

const copy = logCopy.archive;

/** Every word must appear in the title, the standfirst or a tag. */
function matches(entry: LogEntry, words: string[]): boolean {
    const haystack = [entry.title, entry.dek, entry.designation, ...entry.tags]
        .join(" ")
        .toLowerCase();
    return words.every((word) => haystack.includes(word));
}

/**
 * The archive's search over every Flight Log entry, grouped by year in the
 * log index. The server renders the whole list; the search field needs
 * JavaScript, so it is shown only with it (`.js-only`). The count is a
 * polite live region.
 */
export default function ArchiveList({
    entries,
    children,
}: {
    entries: LogEntry[];
    /** Shown between the search and the list: the tag chips. */
    children?: React.ReactNode;
}) {
    const [query, setQuery] = useState("");
    const inputId = useId();
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const shown = words.length
        ? entries.filter((entry) => matches(entry, words))
        : entries;
    const total = entryCount(entries.length);

    return (
        <>
            <div className={`js-only ${styles.search}`} role="search">
                <label className="field__label" htmlFor={inputId}>
                    {copy.searchLabel}
                </label>
                <div className={styles.field}>
                    <Icon name="search" className={styles.icon} />
                    <input
                        id={inputId}
                        className={`input ${styles.input}`}
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={copy.searchPlaceholder}
                        autoComplete="off"
                        spellCheck={false}
                    />
                </div>
            </div>
            {children}
            <p className={styles.count} role="status">
                {words.length ? copy.count(shown.length, total) : total}
            </p>
            {shown.length ? (
                <LogIndex entries={shown} level={2} />
            ) : (
                <div className={styles.empty}>
                    <p className={styles.emptyTitle}>{copy.noMatch}</p>
                    <p className="t-small">{copy.noMatchNote(query.trim())}</p>
                    <Button size="sm" icon="close" onClick={() => setQuery("")}>
                        {copy.clear}
                    </Button>
                </div>
            )}
        </>
    );
}
