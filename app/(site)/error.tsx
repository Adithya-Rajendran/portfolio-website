"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto flex min-h-[65svh] w-full max-w-3xl flex-col justify-center px-6 py-24 sm:px-10"
        >
            <p className="font-term text-xs uppercase tracking-[0.18em] text-accent">
                A brief interruption
            </p>
            <h1 className="mt-6 font-display text-4xl leading-tight tracking-tight text-slate-900 sm:text-5xl dark:text-slate-100">
                This page couldn’t load.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-slate-600 dark:text-slate-400">
                Please try again in a moment.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-6">
                <button
                    type="button"
                    onClick={reset}
                    className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-full bg-accent px-5 py-2 font-term text-xs font-bold text-on-accent shadow-accent ring-accent ring-offset-white transition-all duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-slate-950"
                >
                    Try again
                </button>
                <Link
                    href="/"
                    prefetch={false}
                    className="inline-flex min-h-11 items-center text-sm text-slate-600 transition-colors hover:text-accent dark:text-slate-400"
                >
                    Back to home
                </Link>
            </div>
        </main>
    );
}
