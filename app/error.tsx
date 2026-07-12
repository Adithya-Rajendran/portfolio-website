"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import TerminalSection from "@/components/terminal/terminal-section";

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
                <TerminalSection
                    as="div"
                    command="tail -n 1 site.log"
                    promptVariant="compact"
                    animatePrompt
                    promptClassName="route-prompt mb-3 justify-center"
                >
                    <h2 className="font-display text-2xl font-semibold mb-4 text-slate-900 dark:text-white">
                        Something went wrong
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-8">
                        An unexpected error occurred. Please try again.
                    </p>
                    <Button onClick={reset}>Try again</Button>
                </TerminalSection>
            </div>
        </main>
    );
}
