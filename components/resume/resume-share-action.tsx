"use client";

import { useState, type MouseEvent } from "react";
import { Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ShareStatus = "idle" | "copied" | "shared";

export default function ResumeShareAction({
    canonicalUrl,
    className,
}: {
    canonicalUrl: string;
    className?: string;
}) {
    const [status, setStatus] = useState<ShareStatus>("idle");
    const shareText = "Adithya Rajendran's résumé";
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(canonicalUrl)}`;

    async function handleShare(event: MouseEvent<HTMLAnchorElement>) {
        if (typeof navigator === "undefined") return;

        if (navigator.share) {
            event.preventDefault();
            try {
                await navigator.share({
                    title: shareText,
                    text: shareText,
                    url: canonicalUrl,
                });
                setStatus("shared");
                return;
            } catch (error) {
                if (
                    error instanceof DOMException &&
                    error.name === "AbortError"
                ) {
                    return;
                }
            }
        }

        if (navigator.clipboard?.writeText) {
            event.preventDefault();
            try {
                await navigator.clipboard.writeText(canonicalUrl);
                setStatus("copied");
                return;
            } catch {
                window.location.assign(mailtoUrl);
                return;
            }
        }

        if (event.defaultPrevented) window.location.assign(mailtoUrl);
    }

    const label =
        status === "copied"
            ? "Link copied"
            : status === "shared"
              ? "Shared"
              : "Share";

    return (
        <>
            <a
                href={mailtoUrl}
                onClick={handleShare}
                className={cn("career-action-secondary", className)}
            >
                <Share2 className="size-4" aria-hidden />
                {label}
            </a>
            <span className="sr-only" role="status" aria-live="polite">
                {status === "copied"
                    ? "Résumé link copied to clipboard."
                    : status === "shared"
                      ? "Résumé sharing completed."
                      : ""}
            </span>
        </>
    );
}
