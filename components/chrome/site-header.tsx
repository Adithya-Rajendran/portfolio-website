import { Suspense } from "react";
import Link from "next/link";
import { siteConfig } from "@/lib/config";
import ActiveNavLinks from "@/components/chrome/active-nav-links";
import NavLinks from "@/components/chrome/nav-links";

/**
 * Server Component: the brand and navigation are in the static HTML. Only
 * the active-link state needs the pathname, so that client island sits in
 * a leaf Suspense whose fallback is the same links without `aria-current`
 * (usePathname can suspend for dynamic params under Cache Components).
 */
export default function SiteHeader() {
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
                    <Suspense fallback={<NavLinks />}>
                        <ActiveNavLinks />
                    </Suspense>
                </nav>
            </div>
        </header>
    );
}
