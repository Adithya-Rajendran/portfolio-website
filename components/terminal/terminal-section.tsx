"use client";

import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { cn } from "@/lib/utils";

export const TERM_USER = "adithya@homelab";

/**
 * Static prompt line — the non-animated building block. Decorative
 * (`aria-hidden`): every section pairs it with a real sr-only heading.
 */
export function PromptLine({
    command,
    path = "~",
    cursor = false,
    typedChars,
    className,
}: {
    command: string;
    path?: string;
    /** Show the blinking block cursor at the end of the line. */
    cursor?: boolean;
    /** When set, only this many characters of the command render. */
    typedChars?: number;
    className?: string;
}) {
    const shown =
        typedChars === undefined ? command : command.slice(0, typedChars);
    return (
        <p
            aria-hidden="true"
            className={cn(
                "font-term text-sm text-slate-500 dark:text-slate-400",
                className,
            )}
        >
            <span className="font-bold text-accent">{TERM_USER}</span>
            <span>
                :{path}$ {shown}
            </span>
            {cursor && <span className="term-cursor" />}
        </p>
    );
}

type Phase = "static" | "waiting" | "done";

interface TerminalSectionProps {
    /** The command that gets typed, e.g. "whoami". */
    command: string;
    /** Prompt path segment, e.g. "~" or "~/blogs". */
    path?: string;
    /** Real heading for assistive tech (rendered sr-only). */
    label?: string;
    /** sessionStorage discriminator; defaults to path+command. */
    storageId?: string;
    as?: "section" | "div";
    className?: string;
    promptClassName?: string;
    bodyClassName?: string;
    children: React.ReactNode;
}

/**
 * A content section introduced by a typed terminal prompt. Server-render
 * shows the complete line and body (crawlers, no-JS, and reduced-motion
 * visitors never wait); on first view per browser session the prompt
 * replays as a typed animation when scrolled into view, and the body
 * fades in once the command finishes typing. State is exposed as
 * `data-term-phase` — the reveal CSS lives in app/globals.css.
 */
export default function TerminalSection({
    command,
    path = "~",
    label,
    storageId,
    as: Tag = "section",
    className,
    promptClassName,
    bodyClassName,
    children,
}: TerminalSectionProps) {
    const [phase, setPhase] = useState<Phase>("static");
    const [chars, setChars] = useState(command.length);
    const { ref, inView } = useInView({
        threshold: 0.2,
        triggerOnce: true,
        fallbackInView: true,
    });
    const storageKey = `term-typed:${storageId ?? `${path}$${command}`}`;

    // Arm the animation once per browser session, motion permitting.
    // Deferred a tick so hydration paints the SSR state untouched.
    useEffect(() => {
        try {
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
                return;
            if (sessionStorage.getItem(storageKey) === "1") return;
        } catch {
            return;
        }
        const t = window.setTimeout(() => {
            setChars(0);
            setPhase("waiting");
        }, 0);
        return () => window.clearTimeout(t);
    }, [storageKey]);

    // Type the command once the armed section scrolls into view.
    useEffect(() => {
        if (phase !== "waiting" || !inView) return;
        let cancelled = false;
        let i = 0;
        const tick = () => {
            if (cancelled) return;
            i += 1;
            setChars(i);
            if (i >= command.length) {
                window.setTimeout(() => {
                    if (cancelled) return;
                    setPhase("done");
                    try {
                        sessionStorage.setItem(storageKey, "1");
                    } catch {
                        /* private mode — animation just replays next visit */
                    }
                }, 260);
                return;
            }
            window.setTimeout(tick, 26 + Math.random() * 46);
        };
        window.setTimeout(tick, 180);
        return () => {
            cancelled = true;
        };
    }, [phase, inView, command, storageKey]);

    // "waiting" renders as data-term-phase="typing": the body stays
    // hidden from arm-time until the prompt finishes typing.
    return (
        <Tag
            ref={ref}
            data-term-phase={
                phase === "static"
                    ? undefined
                    : phase === "done"
                      ? "done"
                      : "typing"
            }
            className={className}
        >
            {label && <h2 className="sr-only">{label}</h2>}
            <PromptLine
                command={command}
                path={path}
                typedChars={chars}
                cursor
                className={promptClassName}
            />
            <div className={cn("term-body", bodyClassName)}>{children}</div>
        </Tag>
    );
}
