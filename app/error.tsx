"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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
                <Button onClick={reset}>Try again</Button>
                <Link
                    href="/"
                    className="inline-flex min-h-11 items-center text-sm text-slate-600 transition-colors hover:text-accent dark:text-slate-400"
                >
                    Back to home
                </Link>
            </div>
        </main>
    );
}
