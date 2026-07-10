"use client";

import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import { MailCheck } from "lucide-react";
import {
    subscribeAction,
    INITIAL_NEWSLETTER_FORM_STATE,
} from "@/actions/subscribe";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input-classes";
import { cn } from "@/lib/utils";

function SubscribeButton({ size }: { size: "sm" | "default" }) {
    const { pending } = useFormStatus();

    return (
        <Button
            type="submit"
            size={size}
            disabled={pending}
            aria-busy={pending}
            className="shrink-0"
        >
            {pending ? (
                <>
                    <div
                        aria-hidden
                        className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"
                    ></div>
                    <span className="sr-only">Subscribing…</span>
                </>
            ) : (
                "Subscribe"
            )}
        </Button>
    );
}

/**
 * Newsletter signup island. Two variants:
 * - "footer": compact input+button row for the sitewide footer column.
 * - "inline": os-card CTA block for the end of posts and the blog index.
 *
 * The parent server components stay cacheable; all interactivity lives
 * here (useActionState against actions/subscribe.ts).
 */
export default function NewsletterSignupForm({
    variant,
}: {
    variant: "footer" | "inline";
}) {
    const [state, formAction] = useActionState(
        subscribeAction,
        INITIAL_NEWSLETTER_FORM_STATE,
    );
    const inputId = useId();
    const errorId = useId();

    const hasError = state.status === "error";
    const compact = variant === "footer";

    const form =
        state.status === "success" ? (
            <p
                className={cn(
                    "flex items-center gap-2 text-slate-600 dark:text-slate-300",
                    compact ? "text-sm" : "text-base",
                )}
            >
                <MailCheck
                    aria-hidden
                    className="w-4 h-4 shrink-0 text-accent"
                />
                Almost there — check your inbox to confirm your subscription.
            </p>
        ) : (
            <form
                action={formAction}
                className={cn(
                    "flex flex-col gap-2",
                    !compact && "sm:flex-row sm:gap-3",
                )}
            >
                <div className="flex-1">
                    <label htmlFor={inputId} className="sr-only">
                        Your email address
                    </label>
                    <input
                        id={inputId}
                        className={cn(inputClasses, compact ? "h-10" : "h-12")}
                        name="email"
                        type="email"
                        required
                        maxLength={254}
                        placeholder="you@example.com"
                        aria-invalid={hasError || undefined}
                        aria-describedby={hasError ? errorId : undefined}
                        defaultValue={hasError ? state.values.email : undefined}
                    />
                    {hasError && (
                        <p
                            id={errorId}
                            role="alert"
                            className="mt-2 text-sm text-rose-700 dark:text-rose-300"
                        >
                            {state.message}
                        </p>
                    )}
                </div>
                <SubscribeButton size={compact ? "sm" : "default"} />
            </form>
        );

    if (compact) {
        return <div aria-live="polite">{form}</div>;
    }

    return (
        <section aria-label="Newsletter signup" className="os-card p-6 sm:p-8">
            <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                Get the next deep-dive in your inbox
            </h2>
            <p className="mt-2 mb-5 text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                Infrastructure, Kubernetes, and security write-ups, roughly
                every two weeks. Free — no spam, unsubscribe anytime.
            </p>
            <div aria-live="polite">{form}</div>
        </section>
    );
}
