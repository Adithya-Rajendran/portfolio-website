"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Copy-to-clipboard button for code blocks. A tiny client leaf: the code
 * card itself stays server-rendered; only the raw code string crosses
 * the serialization boundary.
 */
export default function CopyButton({ code }: { code: string }) {
    const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
    const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (resetTimer.current) clearTimeout(resetTimer.current);
        };
    }, []);

    function flash(next: "copied" | "failed") {
        setStatus(next);
        if (resetTimer.current) clearTimeout(resetTimer.current);
        resetTimer.current = setTimeout(() => setStatus("idle"), 2000);
    }

    async function copy() {
        try {
            await navigator.clipboard.writeText(code);
            flash("copied");
        } catch {
            // Clipboard API unavailable (permissions, insecure context) —
            // say so instead of silently pretending it worked.
            flash("failed");
        }
    }

    return (
        <button
            type="button"
            onClick={copy}
            aria-label="Copy code to clipboard"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 dark:border-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-accent hover:border-accent-soft transition-colors shrink-0"
        >
            {status === "copied" ? (
                <Check aria-hidden className="w-3 h-3 text-accent" />
            ) : (
                <Copy aria-hidden className="w-3 h-3" />
            )}
            {status === "idle" && "Copy"}
            {status === "copied" && "Copied"}
            {status === "failed" && "Copy failed"}
            {/* Announced state change for screen readers — aria-label
                mutations on a focused element are not reliably re-read. */}
            <span aria-live="polite" role="status" className="sr-only">
                {status === "copied" && "Code copied to clipboard"}
                {status === "failed" && "Copying failed"}
            </span>
        </button>
    );
}
