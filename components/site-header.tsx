"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { siteConfig } from "@/lib/config";
import { primaryNavigation } from "@/lib/navigation";

export default function SiteHeader() {
    const pathname = usePathname();
    return (
        <header className="journal-container">
            <div className="journal-header">
                <Link
                    href="/"
                    prefetch={false}
                    className="journal-name"
                    aria-label={`${siteConfig.author} — home`}
                >
                    {siteConfig.author}
                    <span aria-hidden>.</span>
                </Link>
                <nav className="journal-nav" aria-label="Primary navigation">
                    {primaryNavigation.map(({ href, label }) => (
                        <Link
                            key={href}
                            href={href}
                            aria-current={
                                pathname === href ||
                                pathname.startsWith(`${href}/`)
                                    ? "page"
                                    : undefined
                            }
                        >
                            {label}
                        </Link>
                    ))}
                    <a
                        className="journal-rss"
                        href="/feed.xml"
                        aria-label="Follow via RSS"
                    >
                        RSS <span aria-hidden>↗</span>
                    </a>
                </nav>
            </div>
        </header>
    );
}
