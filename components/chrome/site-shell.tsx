import "@/app/globals.css";
import "@/app/journal-blog.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import Footer from "@/components/footer";
import SiteHeader from "@/components/chrome/site-header";
import { PersonJsonLd, WebSiteJsonLd } from "@/components/json-ld";

/**
 * Server-rendered public site chrome. It is part of every page's static
 * shell, so the header, navigation and footer are present without
 * JavaScript and each page's content is rendered exactly once. Rendered by
 * app/(site)/layout.tsx and, for unmatched URLs, app/not-found.tsx. The
 * Studio sits outside the (site) group and never loads any of this.
 */
export default function SiteShell({ children }: { children: React.ReactNode }) {
    return (
        <>
            {/* Bypass block for keyboard/switch users (WCAG 2.4.1) */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[1100] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent"
            >
                Skip to content
            </a>
            <div className="journal-frame">
                <div className="journal-stars" aria-hidden="true" />
                <SiteHeader />
                <div className="min-h-[calc(100svh-var(--site-header-height))]">
                    {children}
                </div>
                {/* No Suspense: the footer reads only cached data, so it
                    belongs to the static shell. Inside a boundary late in a
                    long page, React would stream it as a hidden segment that
                    only JavaScript reveals. */}
                <Footer />
            </div>
            {/* ProfilePageJsonLd lives on /about — its semantically correct
                home — rather than sitewide. */}
            <PersonJsonLd />
            <WebSiteJsonLd />
            <SpeedInsights />
            <Analytics />
        </>
    );
}
