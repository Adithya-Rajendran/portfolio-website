"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BlogNav() {
    const pathname = usePathname();
    const isArchive = pathname === "/blogs/archive";
    const isArticle =
        pathname.startsWith("/blogs/") &&
        !isArchive &&
        !pathname.startsWith("/blogs/tags/");

    return (
        <nav
            aria-label="Writing navigation"
            className="os-subnav sticky top-16 z-[900] h-12 border-x-0"
        >
            <div className="mx-auto flex h-full w-full max-w-7xl items-center gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8">
                {isArticle ? (
                    <Link
                        href="/blogs"
                        className="os-press flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-2 text-[0.7rem] font-semibold text-accent transition-opacity hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c1))] sm:text-xs"
                    >
                        <ArrowLeft aria-hidden className="size-3.5" />
                        All posts
                    </Link>
                ) : (
                    <span className="shrink-0 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-accent sm:text-xs">
                        Blog
                    </span>
                )}

                <span
                    aria-hidden
                    className="h-4 w-px shrink-0 bg-slate-300/80 dark:bg-white/10"
                />

                <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <Link
                        href="/blogs"
                        aria-current={
                            pathname === "/blogs" ? "page" : undefined
                        }
                        className={cn(
                            "os-press inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[0.72rem] font-medium transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c1))] sm:text-[0.78rem]",
                            pathname === "/blogs"
                                ? "border border-accent-soft bg-accent-soft text-accent"
                                : "text-slate-600 dark:text-slate-300",
                        )}
                    >
                        Latest
                    </Link>
                    <Link
                        href="/blogs/archive"
                        aria-current={isArchive ? "page" : undefined}
                        className={cn(
                            "os-press inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[0.72rem] font-medium transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c1))] sm:text-[0.78rem]",
                            isArchive
                                ? "border border-accent-soft bg-accent-soft text-accent"
                                : "text-slate-600 dark:text-slate-300",
                        )}
                    >
                        Archive
                    </Link>
                    <a
                        href="/feed.xml"
                        className="os-press inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[0.72rem] font-medium text-slate-600 transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c1))] dark:text-slate-300 sm:text-[0.78rem]"
                    >
                        RSS
                    </a>
                </div>
            </div>
        </nav>
    );
}
