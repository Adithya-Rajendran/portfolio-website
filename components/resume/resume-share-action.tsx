"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cvCopy as copy } from "@/lib/copy";

type ShareStatus = "idle" | "copied" | "shared";

/**
 * Share the CV's address: the system share sheet where there is one,
 * otherwise a copy to the clipboard. It needs JavaScript, so it is not
 * shown without it (`js-only`), and it never falls back to an email link:
 * the site publishes no address and opens no mail client for the reader.
 */
export default function ResumeShareAction({
    canonicalUrl,
    title,
}: {
    canonicalUrl: string;
    title: string;
}) {
    const [status, setStatus] = useState<ShareStatus>("idle");

    // The label reverts after a moment, and when the page is hidden.
    useEffect(() => {
        if (status === "idle") return;
        const timer = window.setTimeout(() => setStatus("idle"), 2400);
        return () => window.clearTimeout(timer);
    }, [status]);
    useLayoutEffect(() => () => setStatus("idle"), []);

    async function share() {
        if (navigator.share) {
            try {
                await navigator.share({ title, url: canonicalUrl });
                setStatus("shared");
                return;
            } catch (error) {
                if (
                    error instanceof DOMException &&
                    error.name === "AbortError"
                )
                    return;
            }
        }
        try {
            await navigator.clipboard.writeText(canonicalUrl);
            setStatus("copied");
        } catch {
            setStatus("idle");
        }
    }

    return (
        <>
            <Button
                size="sm"
                variant="quiet"
                icon={status === "idle" ? "share" : "check"}
                className="js-only"
                onClick={share}
            >
                {status === "copied"
                    ? copy.copied
                    : status === "shared"
                      ? copy.shared
                      : copy.share}
            </Button>
            <span className="sr-only" role="status" aria-live="polite">
                {status === "copied" ? copy.announceCopied : ""}
            </span>
        </>
    );
}
