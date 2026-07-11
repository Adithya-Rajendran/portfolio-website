import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export const TERM_USER = "adithya@prod";

type PromptStyle = CSSProperties & {
    "--term-steps"?: number;
    "--term-width"?: string;
    "--term-duration"?: string;
};

/**
 * Decorative terminal prompt. Prompts are static by default; the homepage
 * can opt into one short CSS-only type-on flourish. Reduced motion disables
 * it and the complete command remains present in the HTML.
 */
export function PromptLine({
    command,
    path = "~",
    cursor = false,
    animated = false,
    typedChars,
    className,
}: {
    command: string;
    path?: string;
    /** Show the block cursor at the end of the line. */
    cursor?: boolean;
    /** Opt into a CSS-only type-on flourish, intended for one hero only. */
    animated?: boolean;
    /** Retained for callers that intentionally render a command excerpt. */
    typedChars?: number;
    className?: string;
}) {
    const shown =
        typedChars === undefined ? command : command.slice(0, typedChars);
    const duration = Math.min(480, Math.max(220, shown.length * 18));
    const style: PromptStyle | undefined = animated
        ? {
              "--term-steps": Math.max(shown.length, 1),
              "--term-width": `${Math.max(shown.length, 1)}ch`,
              "--term-duration": `${duration}ms`,
          }
        : undefined;

    return (
        <p
            aria-hidden="true"
            className={cn(
                "flex items-baseline overflow-hidden font-term text-sm text-slate-600 dark:text-slate-400",
                className,
            )}
        >
            <span className="shrink-0 font-bold text-accent">{TERM_USER}</span>
            <span className="shrink-0">:{path}$&nbsp;</span>
            <span
                className={cn("term-cmd min-w-0", animated && "term-cmd-type")}
                style={style}
            >
                {shown}
            </span>
            {(cursor || animated) && (
                <span
                    className={cn(
                        "term-cursor shrink-0",
                        animated && "term-cursor-once",
                    )}
                />
            )}
        </p>
    );
}

interface TerminalSectionProps {
    command: string;
    path?: string;
    /** Real heading for assistive tech (rendered sr-only). */
    label?: string;
    as?: "section" | "div";
    /** Only the primary hero should opt into prompt animation. */
    animatePrompt?: boolean;
    className?: string;
    promptClassName?: string;
    bodyClassName?: string;
    children: React.ReactNode;
}

/**
 * A content section introduced by a lightweight terminal prompt. Meaningful
 * content is never hidden for animation, hydration, or intersection state.
 */
export default function TerminalSection({
    command,
    path = "~",
    label,
    as: Tag = "section",
    animatePrompt = false,
    className,
    promptClassName,
    bodyClassName,
    children,
}: TerminalSectionProps) {
    return (
        <Tag className={cn("term-section", className)}>
            {label && <h2 className="sr-only">{label}</h2>}
            <PromptLine
                command={command}
                path={path}
                animated={animatePrompt}
                className={promptClassName}
            />
            <div className={cn("term-body", bodyClassName)}>{children}</div>
        </Tag>
    );
}
