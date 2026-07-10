"use client";

import { useEffect } from "react";
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
        <main className="flex flex-col items-center justify-center min-h-[60vh] px-4">
            <div className="os-card w-full max-w-md px-7 py-10 sm:px-10 text-center">
                <p
                    aria-hidden
                    className="font-term text-xs text-slate-500 dark:text-slate-400 mb-3"
                >
                    # exit status 1
                </p>
                <h2 className="font-display text-2xl font-semibold mb-4 text-slate-900 dark:text-white">
                    Something went wrong
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mb-8">
                    An unexpected error occurred. Please try again.
                </p>
                <Button onClick={reset}>Try again</Button>
            </div>
        </main>
    );
}
