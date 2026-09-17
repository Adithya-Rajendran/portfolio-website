import "./globals.css";
import "./journal-blog.css";
import { Suspense } from "react";
import { DM_Sans, IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { BotIdClient } from "botid/client";
import Footer from "@/components/footer";
import SiteFrame from "@/components/site-frame";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import { PersonJsonLd, WebSiteJsonLd } from "@/components/json-ld";
import type { Metadata } from "next";
import type { Viewport } from "next";
import { siteConfig, THEME_COLORS } from "@/lib/config";
import { getProfile } from "@/lib/sanity-client";
import { getProfileDescription } from "@/lib/profile-content";
import { FEED_PATH, FEED_TITLE } from "@/lib/feed";

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

export async function generateMetadata(): Promise<Metadata> {
    const profile = await getProfile();
    const description = getProfileDescription(profile);
    return {
        title: {
            default: siteConfig.title,
            template: `%s | ${siteConfig.author}`,
        },
        description,
        alternates: {
            canonical: siteConfig.url,
            types: {
                "application/rss+xml": [{ url: FEED_PATH, title: FEED_TITLE }],
            },
        },
        keywords: [
            siteConfig.author,
            "Personal website",
            "Personal blog",
            ...(profile?.focusAreas || []),
        ],
        robots: {
            index: true,
            follow: true,
        },
        category: "technology",
        metadataBase: new URL(siteConfig.url),
        openGraph: {
            title: siteConfig.title,
            description,
            url: siteConfig.url,
            siteName: "Adithya Rajendran",
            locale: "en_US",
            type: "website",
        },
        twitter: {
            card: "summary_large_image",
            title: siteConfig.title,
            description,
        },
        verification: {
            google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
        },
    };
}

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
        { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
    ],
};

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
                {/* ProfilePageJsonLd lives on /about — its semantically
                    correct home — rather than sitewide. */}
                <PersonJsonLd />
                <WebSiteJsonLd />
            </head>
            <body
                className={`${dmSans.className} min-h-screen bg-canvas text-slate-100 antialiased`}
            >
                {/* Bypass block for keyboard/switch users (WCAG 2.4.1) */}
                <a
                    href="#main-content"
                    className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[1100] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent"
                >
                    Skip to content
                </a>

                <Suspense fallback={children}>
                    <SiteFrame
                        footer={
                            <Suspense fallback={null}>
                                <Footer />
                            </Suspense>
                        }
                    >
                        {children}
                    </SiteFrame>
                </Suspense>
                <SpeedInsights />
                <Analytics />
            </body>
        </html>
    );
}
