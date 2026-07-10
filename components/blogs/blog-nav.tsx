"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BlogNav() {
    const pathname = usePathname();
    const isPostPage = pathname !== "/blogs" && pathname.startsWith("/blogs/");
    // Current location rendered as a shell path — "/blogs/archive" →
    // "~/blogs/archive". Decorative (aria-hidden): the back link carries
    // the real semantics.
    const displayPath = pathname === "/" ? "~" : `~${pathname}`;

    return (
        <nav className="os-nav fixed top-0 left-0 right-0 z-[999] h-[3.5rem] flex items-center gap-4 px-6 rounded-none border-x-0 border-t-0">
            <Link
                href={isPostPage ? "/blogs" : "/"}
                aria-label={isPostPage ? "Back to blog" : "Back to home"}
                className="flex items-center gap-2 font-term text-sm font-bold text-accent hover:opacity-80 transition-opacity whitespace-nowrap"
            >
                <ArrowLeft aria-hidden className="w-4 h-4" />
                {isPostPage ? "cd ~/blogs" : "cd ~"}
            </Link>
            <span
                aria-hidden
                className="ml-auto min-w-0 truncate font-term text-xs text-slate-500 dark:text-slate-400"
            >
                {displayPath}
            </span>
        </nav>
    );
}
