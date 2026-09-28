import "@/app/globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import Footer from "@/components/footer";
import SiteHeader from "@/components/chrome/site-header";
import SvgSprite from "@/components/chrome/svg-sprite";
import { PersonJsonLd, WebSiteJsonLd } from "@/components/json-ld";
import { chromeCopy } from "@/lib/copy";

/**
 * Server-rendered public site chrome, part of every page's static shell:
 * the skip link, the sprite, the header, the one <main>, the footer,
 * JSON-LD and analytics. Rendered by app/(site)/layout.tsx and, for
 * unmatched URLs, app/global-not-found.tsx. The Studio sits outside the
 * (site) group and never loads any of this.
 *
 * The <main> is owned here, not by the pages: Cache Components keeps up to
 * three visited routes mounted but hidden (Activity), so a page-owned
 * <main> would repeat in the document and the skip link could land in a
 * hidden page. Each page renders a root element with `data-page`, which
 * scopes its styles.
 */
export default function SiteShell({ children }: { children: React.ReactNode }) {
    return (
        <>
            <a className="skip-link" id="top" href="#main-content">
                {chromeCopy.skipLink}
            </a>
            <SvgSprite />
            <SiteHeader />
            <main id="main-content" tabIndex={-1}>
                {children}
            </main>
            {/* No Suspense: the footer reads only cached data, so it
                belongs to the static shell. Inside a boundary late in a
                long page, React would stream it as a hidden segment that
                only JavaScript reveals. */}
            <Footer />
            {/* ProfilePageJsonLd lives on /about, its semantically correct
                home, rather than sitewide. */}
            <PersonJsonLd />
            <WebSiteJsonLd />
            <SpeedInsights />
            <Analytics />
        </>
    );
}
