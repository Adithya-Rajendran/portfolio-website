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
        <main className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
            <h2 className="font-display text-2xl font-semibold mb-4 text-slate-900 dark:text-white">
                Something went wrong
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md">
                An unexpected error occurred. Please try again.
            </p>
            <Button onClick={reset}>Try again</Button>
        </main>
    );
}
