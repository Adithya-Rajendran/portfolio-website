import { DM_Sans, IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { BotIdClient } from "botid/client";
import type { Metadata } from "next";
import type { Viewport } from "next";
import { siteConfig, THEME_COLORS } from "@/lib/config";

const dmSans = DM_Sans({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-dm-sans",
});

const spaceGrotesk = Space_Grotesk({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-space-grotesk",
});

// Self-hosted type for dates and small editorial labels.
const ibmPlexMono = IBM_Plex_Mono({
    weight: ["400", "500"],
    subsets: ["latin"],
    display: "swap",
    variable: "--font-ibm-plex-mono",
});

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

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
        { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
    ],
};

/**
 * The minimal root layout shared by the public site and the Studio. The
 * site chrome, stylesheets, JSON-LD and analytics live in
 * components/chrome/site-shell.tsx, rendered by app/(site)/layout.tsx, so
 * none of them load inside /studio.
 */
export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html
            lang="en"
            className={`dark ${dmSans.variable} ${spaceGrotesk.variable} ${ibmPlexMono.variable}`}
            suppressHydrationWarning
        >
            <head>
                {/* BotID protects the contact action. Server Actions post to
                    the page that invokes them, so every public path needs the
                    challenge header. */}
                <BotIdClient protect={[{ path: "/*", method: "POST" }]} />
            </head>
            <body
                className={`${dmSans.className} min-h-screen bg-canvas text-slate-100 antialiased`}
            >
                {children}
            </body>
        </html>
    );
}
