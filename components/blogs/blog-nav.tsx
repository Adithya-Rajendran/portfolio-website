"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    CONTEXT_NAV_ITEM_CLASSES,
    CONTEXT_NAV_LABEL_CLASSES,
    ContextNav,
} from "@/components/context-nav";

export default function BlogNav() {
    const pathname = usePathname();
    const isArchive = pathname === "/blog/archive";
    const isArticle =
        pathname.startsWith("/blog/") &&
        !isArchive &&
        !pathname.startsWith("/blog/tags/");

    return (
        <ContextNav
            ariaLabel="Writing navigation"
            collapseIdentityOnMobile={!isArticle}
            identity={
                isArticle ? (
                    <Link
                        href="/blog"
                        className="os-press flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-2 font-term text-[0.7rem] font-semibold text-accent transition-opacity hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c1))] sm:text-xs"
                    >
                        <ArrowLeft aria-hidden className="size-3.5" />
                        All posts
                    </Link>
                ) : (
                    <span className={CONTEXT_NAV_LABEL_CLASSES}>Blog</span>
                )
            }
        >
            <ul className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <li className="shrink-0">
                    <Link
                        href="/blog"
                        aria-current={pathname === "/blog" ? "page" : undefined}
                        className={cn(
                            CONTEXT_NAV_ITEM_CLASSES,
                            pathname === "/blog"
                                ? "border border-accent-soft bg-accent-soft text-accent"
                                : "text-slate-600 dark:text-slate-300",
                        )}
                    >
                        Latest
                    </Link>
                </li>
                <li className="shrink-0">
                    <Link
                        href="/blog/archive"
                        aria-current={isArchive ? "page" : undefined}
                        className={cn(
                            CONTEXT_NAV_ITEM_CLASSES,
                            isArchive
                                ? "border border-accent-soft bg-accent-soft text-accent"
                                : "text-slate-600 dark:text-slate-300",
                        )}
                    >
                        Archive
                    </Link>
                </li>
                <li className="shrink-0">
                    <a
                        href="/feed.xml"
                        className={cn(
                            CONTEXT_NAV_ITEM_CLASSES,
                            "text-slate-600 dark:text-slate-300",
                        )}
                    >
                        RSS
                    </a>
                </li>
            </ul>
        </ContextNav>
    );
}
