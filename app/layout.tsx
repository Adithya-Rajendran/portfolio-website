import { BotIdClient } from "botid/client";
import type { Metadata, Viewport } from "next";
import ThemeBootScript from "@/components/chrome/theme-boot-script";
import { siteConfig } from "@/lib/config";
import { fontVariables } from "@/lib/fonts";

/**
 * Only what every route needs, including the Studio and unmatched URLs.
 * Profile-derived site metadata lives in app/(site)/layout.tsx.
 */
export const metadata: Metadata = {
    metadataBase: new URL(siteConfig.url),
    title: {
        default: siteConfig.title,
        template: `%s | ${siteConfig.author}`,
    },
};

// theme-color and color-scheme are added by the boot script (ThemeBootScript)
// for the theme it applies. No viewportFit: a phone keeps the page inside
// the notch and the home indicator, so nothing pads for them. "cover" (an
// edge-to-edge hero or flight) needs env(safe-area-inset-*) padding on the
// header, the flight's rail and Play, and the footer in the same change.
export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
};

/**
 * The minimal root layout shared by the public site and the Studio: the
 * font variables, the theme and motion boot script, and BotID. The site
 * chrome, stylesheets, JSON-LD and analytics live in
 * components/chrome/site-shell.tsx, rendered by app/(site)/layout.tsx, so
 * none of them load inside /studio.
 *
 * The server always renders the literal `data-theme="void"` and no
 * `data-motion`; the boot script sets both before the first paint. The
 * prop never changes between renders, so React never overwrites what the
 * script set (`suppressHydrationWarning` covers the first hydration).
 */
export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html
            lang="en"
            data-theme="void"
            className={fontVariables}
            suppressHydrationWarning
        >
            <head>
                <ThemeBootScript />
                {/* BotID protects the contact action. Server Actions post to
                    the page that invokes them, so every public path needs the
                    challenge header. */}
                <BotIdClient protect={[{ path: "/*", method: "POST" }]} />
            </head>
            <body>{children}</body>
        </html>
    );
}
