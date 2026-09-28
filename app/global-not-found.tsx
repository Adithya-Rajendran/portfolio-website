import type { Metadata, Viewport } from "next";
import SiteShell from "@/components/chrome/site-shell";
import ThemeBootScript from "@/components/chrome/theme-boot-script";
import LossOfSignal from "@/components/los/loss-of-signal";
import NotFoundActions from "@/components/los/not-found-actions";
import { siteConfig } from "@/lib/config";
import { lossOfSignalCopy as copy } from "@/lib/copy";
import { fontVariables } from "@/lib/fonts";

export const metadata: Metadata = {
    metadataBase: new URL(siteConfig.url),
    title: `Page not found | ${siteConfig.author}`,
    robots: { index: false, follow: false },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
};

/**
 * Unmatched URLs (experimental.globalNotFound, next.config.mjs). Next.js
 * serves this document directly, without the root layout, so it repeats
 * the root layout's <html>: the font variables and the theme boot script.
 * It replaces a root app/not-found.tsx, whose stylesheet Next.js attached
 * to every route under the root layout, the Studio included. The Loss of
 * Signal page is the same one app/(site)/not-found.tsx renders.
 */
export default function GlobalNotFound() {
    return (
        <html
            lang="en"
            data-theme="void"
            className={fontVariables}
            suppressHydrationWarning
        >
            <head>
                <ThemeBootScript />
            </head>
            <body>
                <SiteShell>
                    <LossOfSignal
                        page="not-found"
                        tag={copy.tag}
                        themed={copy.themed}
                        plain={copy.plain}
                        title={copy.title}
                        lead={copy.lead}
                        actions={<NotFoundActions />}
                        showRequested
                    />
                </SiteShell>
            </body>
        </html>
    );
}
