import type { Metadata } from "next";
import Link from "next/link";
import TerminalSection, {
    PromptLine,
} from "@/components/terminal/terminal-section";

export const metadata: Metadata = {
    title: "404 — no such file or directory",
    robots: { index: false, follow: false },
    alternates: { canonical: null },
};

/**
 * Terminal-native 404: a failed `cd` with the shell's error line, mono
 * throughout (the one page where full commitment is the joke), bracket
 * links back to real destinations, and a parked cursor. The prompt is
 * decorative (aria-hidden) — the sr-only h1 and the visible error lines
 * carry the semantics.
 */
export default function NotFound() {
    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="flex min-h-[calc(100svh-var(--site-header-height))] w-full flex-col items-center justify-center px-6 sm:px-8"
        >
            <section className="w-full max-w-2xl">
                <h1 className="sr-only">404: Page not found</h1>
                <TerminalSection
                    as="div"
                    command="cd /wherever-you-were-going"
                    animatePrompt
                >
                    <p className="mt-4 font-term text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                        bash: cd: /wherever-you-were-going: No such file or
                        directory
                    </p>
                    <p className="mt-2 font-term text-sm text-slate-600 dark:text-slate-400">
                        # exit 404 — this page doesn&apos;t exist or has moved.
                    </p>
                    <nav
                        aria-label="Page links"
                        className="mt-8 flex flex-wrap gap-x-6 gap-y-2"
                    >
                        <Link
                            href="/"
                            className="font-term text-sm font-bold text-accent hover:opacity-80 transition-opacity"
                        >
                            [ cd ~ ]
                        </Link>
                        <Link
                            href="/blog"
                            className="font-term text-sm text-slate-600 hover:text-accent dark:text-slate-400 transition-colors"
                        >
                            [ cd ~/blog ]
                        </Link>
                        <Link
                            href="/portfolio"
                            className="font-term text-sm text-slate-600 hover:text-accent dark:text-slate-400 transition-colors"
                        >
                            [ cd ~/portfolio ]
                        </Link>
                    </nav>
                    <PromptLine command="" cursor className="mt-10" />
                </TerminalSection>
            </section>
        </main>
    );
}
