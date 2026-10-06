import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
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
    // No robots: Next.js already sets noindex on a 404.
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
};

/**
 * The font files every other page preloads (lib/fonts.ts). Next.js looks
 * a layout's fonts up by its file, and its font manifest lists this
 * document under the not-found route's page instead, so it preloads none
 * here and the title re-wrapped when the faces swapped in. Read from the
 * build's manifest (the prerender runs after it is written); none when it
 * cannot be read.
 */
function preloadedFonts(): string[] {
    try {
        const manifest = JSON.parse(
            readFileSync(
                join(
                    process.cwd(),
                    ".next",
                    "server",
                    "next-font-manifest.json",
                ),
                "utf8",
            ),
        ) as { app?: Record<string, string[]> };
        const entry = Object.entries(manifest.app ?? {}).find(([page]) =>
            page.endsWith("app/_not-found/page"),
        );
        return (entry?.[1] ?? []).filter((file) => file.endsWith(".woff2"));
    } catch {
        return [];
    }
}

const FONTS = preloadedFonts();

/**
 * Unmatched URLs (experimental.globalNotFound, next.config.mjs). Next.js
 * serves this document directly, without the root layout, so it repeats
 * the root layout's <html>: the font variables and the theme boot script.
 * It replaces a root app/not-found.tsx, whose stylesheet Next.js attached
 * to every route under the root layout, the Studio included. The Loss of
 * Signal page is the same one app/(site)/not-found.tsx renders. Its
 * router cannot render the (site) routes, so every link here is a plain
 * <a href> that loads the page in full, and the build copies it to a
 * static 404.html that no webhook refreshes, so it carries no JSON-LD
 * (SiteShell `standalone`).
 */
export default function GlobalNotFound() {
    for (const file of FONTS)
        preload(`/_next/${file}`, {
            as: "font",
            type: "font/woff2",
            crossOrigin: "",
        });
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
                <SiteShell standalone>
                    <LossOfSignal
                        page="not-found"
                        tag={copy.tag}
                        title={copy.title}
                        lead={copy.lead}
                        actions={<NotFoundActions plain />}
                        missed
                        plainLinks
                    />
                </SiteShell>
            </body>
        </html>
    );
}
