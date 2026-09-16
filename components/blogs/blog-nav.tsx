"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BlogNav() {
    const pathname = usePathname();
    return (
        <nav
            aria-label="Writing navigation"
            className="journal-container journal-blog-nav"
        >
            <Link
                href="/blog"
                aria-current={pathname === "/blog" ? "page" : undefined}
            >
                Latest writing
            </Link>
            <Link
                href="/blog/archive"
                aria-current={pathname === "/blog/archive" ? "page" : undefined}
            >
                Archive
            </Link>
            <a href="/feed.xml" className="journal-blog-rss">
                RSS <span aria-hidden>↗</span>
            </a>
        </nav>
    );
}
