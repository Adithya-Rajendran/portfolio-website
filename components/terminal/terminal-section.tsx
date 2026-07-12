import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export const TERM_USER = "adithya@prod";

type PromptStyle = CSSProperties & {
    "--term-steps"?: number;
    "--term-width"?: string;
    "--term-duration"?: string;
    "--term-reveal-delay"?: string;
    "--term-output-duration"?: string;
    "--term-output-shift"?: string;
};

type PromptVariant = "full" | "compact";

const getPromptDuration = (characters: number) =>
    Math.min(1200, Math.max(720, characters * 110));

/**
 * Decorative terminal prompt. Prompts are static by default; one route-level
 * prompt per page may opt into a CSS-only type-on flourish. Reduced motion
 * disables it and the complete command remains present in the HTML.
 */
export function PromptLine({
    command,
    path = "~",
    cursor = false,
    animated = false,
    variant = "full",
    typedChars,
    className,
}: {
    command: string;
    path?: string;
    /** Show the block cursor at the end of the line. */
    cursor?: boolean;
    /** Opt into the single CSS-only type-on flourish for the current route. */
    animated?: boolean;
    /** Compact prompts continue the shell session without repeating the user. */
    variant?: PromptVariant;
    /** Retained for callers that intentionally render a command excerpt. */
    typedChars?: number;
    className?: string;
}) {
    const shown =
        typedChars === undefined ? command : command.slice(0, typedChars);
    const duration = getPromptDuration(shown.length);
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
            style={style}
            className={cn(
                "flex items-baseline overflow-hidden font-term text-sm text-slate-600 dark:text-slate-400",
                className,
            )}
        >
            {variant === "full" ? (
                <>
                    <span className="shrink-0 font-bold text-accent">
                        {TERM_USER}
                    </span>
                    <span className="shrink-0">:{path}$&nbsp;</span>
                </>
            ) : path ? (
                <>
                    <span className="shrink-0 font-bold text-accent">
                        {path}
                    </span>
                    <span className="shrink-0">&nbsp;$&nbsp;</span>
                </>
            ) : (
                <span className="shrink-0 font-bold text-accent">$&nbsp;</span>
            )}
            <span
                className={cn("term-cmd min-w-0", animated && "term-cmd-type")}
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
    id?: string;
    /** Real heading for assistive tech (rendered sr-only). */
    label?: string;
    as?: "section" | "div" | "header";
    /** Only the single route introduction should opt into animation. */
    animatePrompt?: boolean;
    promptVariant?: PromptVariant;
    className?: string;
    promptClassName?: string;
    bodyClassName?: string;
    children: React.ReactNode;
}

/**
 * A route-level command followed by its complete server-rendered output.
 * Scripting may briefly delay the output reveal; no-JS and reduced-motion
 * visitors receive the complete static route immediately.
 */
export default function TerminalSection({
    command,
    path = "~",
    id,
    label,
    as: Tag = "section",
    animatePrompt = false,
    promptVariant = "full",
    className,
    promptClassName,
    bodyClassName,
    children,
}: TerminalSectionProps) {
    const promptDuration = getPromptDuration(command.length);
    const animationStyle: PromptStyle | undefined = animatePrompt
        ? {
              "--term-duration": `${promptDuration}ms`,
              "--term-reveal-delay": `${promptDuration + 140}ms`,
              "--term-output-duration": "560ms",
              "--term-output-shift": "0.7rem",
          }
        : undefined;

    return (
        <Tag
            id={id}
            className={cn("term-section", className)}
            style={animationStyle}
        >
            {label && <h2 className="sr-only">{label}</h2>}
            <PromptLine
                command={command}
                path={path}
                animated={animatePrompt}
                variant={promptVariant}
                className={promptClassName}
            />
            <div
                className={cn(
                    "term-body",
                    animatePrompt && "term-output-reveal",
                    bodyClassName,
                )}
            >
                {children}
            </div>
        </Tag>
    );
}
