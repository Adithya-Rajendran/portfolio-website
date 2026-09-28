"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

/**
 * A visible Copy button (a listing's bar, the entry's link). A small client
 * leaf: the listing around it stays server-rendered and only the text to
 * copy crosses the boundary. It needs the Clipboard API, so without
 * JavaScript it is not shown (`js-only`), and a failure says so instead of
 * pretending. The result is announced in a polite status region beside the
 * button (a live region inside a button is not read reliably).
 */
export default function CopyButton({
    text,
    idle,
    done,
    failed,
    label,
    announceDone,
    announceFailed,
    className,
}: {
    text: string;
    /** The visible word: "Copy", "Copy link". */
    idle: string;
    done: string;
    failed: string;
    /** The accessible name, when it says more than `idle`. */
    label?: string;
    announceDone: string;
    announceFailed: string;
    className?: string;
}) {
    const [status, setStatus] = useState<"idle" | "done" | "failed">("idle");
    const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (resetTimer.current) clearTimeout(resetTimer.current);
        };
    }, []);

    function flash(next: "done" | "failed") {
        setStatus(next);
        if (resetTimer.current) clearTimeout(resetTimer.current);
        resetTimer.current = setTimeout(() => setStatus("idle"), 2000);
    }

    async function copy() {
        try {
            await navigator.clipboard.writeText(text);
            flash("done");
        } catch {
            // Clipboard API unavailable (permissions, insecure context).
            flash("failed");
        }
    }

    return (
        <span className="copy js-only">
            <button
                type="button"
                onClick={copy}
                aria-label={label}
                data-state={status}
                className={buttonClass({
                    size: "sm",
                    variant: "quiet",
                    className: className
                        ? `copy__btn ${className}`
                        : "copy__btn",
                })}
            >
                <Icon name={status === "done" ? "check" : "copy"} />
                <span>
                    {status === "done"
                        ? done
                        : status === "failed"
                          ? failed
                          : idle}
                </span>
            </button>
            <span role="status" className="sr-only">
                {status === "done"
                    ? announceDone
                    : status === "failed"
                      ? announceFailed
                      : ""}
            </span>
        </span>
    );
}
