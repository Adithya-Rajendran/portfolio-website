"use client";

import { useEffect } from "react";

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
            <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
                Something went wrong
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md">
                An unexpected error occurred. Please try again.
            </p>
            <button
                onClick={reset}
                className="bg-emerald-700 text-white px-6 py-2 rounded-full hover:bg-emerald-800 transition dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
                Try again
            </button>
        </main>
    );
}
