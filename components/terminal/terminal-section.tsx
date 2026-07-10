"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useInView } from "react-intersection-observer";
import { cn } from "@/lib/utils";

export const TERM_USER = "adithya@homelab";

/**
 * Static prompt line — the non-animated building block. Decorative
 * (`aria-hidden`): every section pairs it with a real sr-only heading.
 * The typed command sits in its own `.term-cmd` span so the pre-hydration
 * mask (app/globals.css) can hide just the command text, leaving the
 * `adithya@homelab:~$` prompt itself untouched.
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
            <span>:{path}$ </span>
            <span className="term-cmd">{shown}</span>
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
    as?: "section" | "div";
    className?: string;
    promptClassName?: string;
    bodyClassName?: string;
    children: React.ReactNode;
}

// Whether the terminal show is armed for this load. The head script in
// app/layout.tsx sets `data-term-arm` before first paint, but only on a
// fresh, motion-permitting load that hasn't played the show yet. Read via
// useSyncExternalStore so the value resolves during hydration — before the
// browser paints — with a stable server value of `false` (the SSR markup is
// always the fully-typed static form, so there is no hydration mismatch).
// subscribe is a no-op: the flag is a mount-time snapshot, never reactive,
// so removing it after the show does not disturb already-mounted sections.
const subscribeArmed = () => () => {};
const getArmedSnapshot = () =>
    typeof document !== "undefined" &&
    document.documentElement.dataset.termArm === "1";
const getArmedServerSnapshot = () => false;

/**
 * A content section introduced by a typed terminal prompt. The server (and
 * every no-JS, reduced-motion, or post-show render) ships the complete line
 * and body, fully visible. On the first armed load of a session the prompt
 * replays as a typed animation when scrolled into view, and the body fades
 * in once the command finishes typing.
 *
 * Flash-free: `term-section` is a stable server-rendered class, and the
 * pre-hydration mask (keyed off `html[data-term-arm]`) hides the command
 * text and body from the very first paint on an armed load — nothing ever
 * paints visible and then hides. State is exposed as `data-term-phase`;
 * the reveal CSS lives in app/globals.css.
 */
export default function TerminalSection({
    command,
    path = "~",
    label,
    as: Tag = "section",
    className,
    promptClassName,
    bodyClassName,
    children,
}: TerminalSectionProps) {
    const armed = useSyncExternalStore(
        subscribeArmed,
        getArmedSnapshot,
        getArmedServerSnapshot,
    );

    const [phase, setPhase] = useState<Phase>("static");
    const [chars, setChars] = useState(command.length);
    const { ref, inView } = useInView({
        threshold: 0.2,
        triggerOnce: true,
        fallbackInView: true,
    });

    // Hand an armed section over to its phase machine. The SSR/hydration
    // render is always the static markup (full command, no phase attr), so
    // there is no hydration mismatch; the switch to typing is invisible
    // because the mask already hid the command text and body pre-hydration.
    // The setState is deferred a tick (matches the reveal effect's cadence
    // pattern) — safe now that the content is CSS-hidden from first paint.
    useEffect(() => {
        if (!armed) return;
        const t = window.setTimeout(() => {
            setChars(0);
            setPhase("waiting");
        }, 0);
        return () => window.clearTimeout(t);
    }, [armed]);

    // Type the command once the armed section scrolls into view, then reveal.
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
                        sessionStorage.setItem("term-played", "1");
                    } catch {
                        /* private mode — show just replays next visit */
                    }
                    // First completion ends the show: drop the arm flag so
                    // any section mounting afterward (client navigation,
                    // streamed-in content) renders static with no flash.
                    // Sections still waiting/typing already carry
                    // data-term-phase, so their hidden state is
                    // attribute-independent and unaffected by the removal.
                    try {
                        delete document.documentElement.dataset.termArm;
                    } catch {
                        /* noop */
                    }
                }, 200);
                return;
            }
            window.setTimeout(tick, 18 + Math.random() * 12);
        };
        window.setTimeout(tick, 150);
        return () => {
            cancelled = true;
        };
    }, [phase, inView, command]);

    // "waiting" renders as data-term-phase="typing": the body stays hidden
    // from arm-time until the prompt finishes typing. The block cursor only
    // exists while typing — never in the static (SSR/no-JS/reduced-motion/
    // post-show) render and never after "done".
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
            className={cn("term-section", className)}
        >
            {label && <h2 className="sr-only">{label}</h2>}
            <PromptLine
                command={command}
                path={path}
                typedChars={chars}
                cursor={phase === "waiting"}
                className={promptClassName}
            />
            <div className={cn("term-body", bodyClassName)}>{children}</div>
        </Tag>
    );
}
