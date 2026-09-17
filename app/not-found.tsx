import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Page not found",
    robots: { index: false, follow: false },
    alternates: { canonical: null },
};

export default function NotFound() {
    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto flex min-h-[65svh] w-full max-w-3xl flex-col justify-center px-6 py-24 sm:px-10"
        >
            <p className="font-term text-xs uppercase tracking-[0.18em] text-accent">
                404 / A missing page
            </p>
            <h1 className="mt-6 font-display text-4xl leading-tight tracking-tight text-slate-900 sm:text-6xl dark:text-slate-100">
                There’s more to explore.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-slate-600 dark:text-slate-400">
                This page may have moved, or the link may be incomplete. You can
                find my latest notes in the writing archive.
            </p>
            <nav
                aria-label="Where to go next"
                className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-slate-300/50 pt-6 dark:border-slate-700/60"
            >
                <Link
                    href="/blog"
                    className="inline-flex min-h-11 items-center text-sm text-accent underline decoration-accent/40 underline-offset-8 hover:decoration-accent"
                >
                    Explore the writing →
                </Link>
                <Link
                    href="/"
                    prefetch={false}
                    className="inline-flex min-h-11 items-center text-sm text-slate-600 transition-colors hover:text-accent dark:text-slate-400"
                >
                    Back to home
                </Link>
            </nav>
        </main>
    );
}
