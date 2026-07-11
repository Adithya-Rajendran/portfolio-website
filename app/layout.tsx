import "./globals.css";
import { Suspense } from "react";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { BotIdClient } from "botid/client";
import Footer from "@/components/footer";
import SiteFrame from "@/components/site-frame";
import ThemeContextProvider from "@/context/theme-context";
import { Toaster } from "@/components/ui/toaster";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import { PersonJsonLd, WebSiteJsonLd } from "@/components/json-ld";
import type { Metadata } from "next";
import type { Viewport } from "next";
import { siteConfig, THEME_COLORS } from "@/lib/config";
import { FEED_PATH, FEED_TITLE } from "@/lib/feed";

const inter = Inter({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-space-grotesk",
});

// Terminal chrome face (prompts, labels, dates) — OFL-licensed, self-hosted
// by next/font. Body copy stays Inter: mono is chrome, never prose.
const jetbrainsMono = JetBrains_Mono({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
    title: {
        default: siteConfig.title,
        template: `%s | ${siteConfig.author}`,
    },
    description: siteConfig.description,
    alternates: {
        canonical: siteConfig.url,
        types: {
            "application/rss+xml": [{ url: FEED_PATH, title: FEED_TITLE }],
        },
    },
    keywords: [
        "Adithya Rajendran",
        "Personal website",
        "Personal blog",
        "Cloud Field Engineer",
        "Canonical",
        "Private Cloud",
        "Field Engineering",
        "Cybersecurity",
        "OpenStack",
        "Kubernetes",
        "DevOps",
        "Cloud Engineering",
    ],
    robots: {
        index: true,
        follow: true,
    },
    category: "technology",
    metadataBase: new URL(siteConfig.url),
    openGraph: {
        title: siteConfig.title,
        description: siteConfig.description,
        url: siteConfig.url,
        siteName: "Adithya Rajendran",
        locale: "en_US",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: siteConfig.title,
        description: siteConfig.description,
    },
    verification: {
        google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
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

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html
            lang="en"
            className={`!scroll-smooth ${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
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
                className={`${inter.className} min-h-screen overflow-x-hidden bg-canvas text-slate-900 antialiased dark:bg-canvas-dark dark:text-slate-100`}
            >
                {/* Bypass block for keyboard/switch users (WCAG 2.4.1) */}
                <a
                    href="#main-content"
                    className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[1100] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent"
                >
                    Skip to content
                </a>

                {/* Static ambient colour wash + fine paper/screen grain. */}
                <div className="mesh-bg" aria-hidden="true" />
                <div className="bg-grain" aria-hidden="true" />

                <ThemeContextProvider>
                    <Suspense fallback={children}>
                        <SiteFrame footer={<Footer />}>{children}</SiteFrame>
                    </Suspense>
                    <Toaster />
                </ThemeContextProvider>
                <SpeedInsights />
                <Analytics />
            </body>
        </html>
    );
}
