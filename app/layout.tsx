import { Suspense } from "react";
import "./globals.css";
import { Inter, Space_Grotesk } from "next/font/google";
import Footer from "@/components/footer";
import ThemeSelector from "@/components/theme-selector";
import ThemeContextProvider from "@/context/theme-context";
import { DEFAULT_THEME } from "@/lib/themes";
import { Toaster } from "@/components/ui/toaster";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import {
    PersonJsonLd,
    WebSiteJsonLd,
    ProfilePageJsonLd,
} from "@/components/json-ld";
import type { Metadata } from "next";
import type { Viewport } from "next";
import { siteConfig } from "@/lib/config";

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

export const metadata: Metadata = {
    title: {
        default: siteConfig.title,
        template: `%s | ${siteConfig.author}`,
    },
    description: siteConfig.description,
    alternates: {
        canonical: siteConfig.url,
    },
    keywords: [
        "Adithya Rajendran",
        "Cloud Field Engineer",
        "Canonical",
        "AWS Solutions Architect",
        "CompTIA Security+",
        "Cybersecurity",
        "OpenStack",
        "Kubernetes",
        "DevOps",
        "Cloud Engineering",
        "Portfolio",
    ],
    robots: {
        index: true,
        follow: true,
    },
    category: "technology",
    icons: {
        icon: [
            {
                url: "/icon-light-32x32.png",
                media: "(prefers-color-scheme: light)",
            },
            {
                url: "/icon-dark-32x32.png",
                media: "(prefers-color-scheme: dark)",
            },
            {
                url: "/icon.svg",
                type: "image/svg+xml",
            },
        ],
        apple: "/apple-icon.png",
    },
    metadataBase: new URL(siteConfig.url),
    openGraph: {
        title: siteConfig.title,
        description: siteConfig.description,
        url: siteConfig.url,
        siteName: "Adithya's Portfolio",
        images: [
            {
                url: "/og-image.jpg",
                width: 1200,
                height: 630,
                alt: `${siteConfig.author} - Cloud Field Engineer & Cybersecurity Portfolio`,
            },
        ],
        locale: "en_US",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: siteConfig.title,
        description: siteConfig.description,
        images: {
            url: "/og-image.jpg",
            alt: `${siteConfig.author} - Cloud Field Engineer & Cybersecurity Portfolio`,
        },
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
        { media: "(prefers-color-scheme: light)", color: "#f5f7fb" },
        { media: "(prefers-color-scheme: dark)", color: "#07091a" },
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
            className={`!scroll-smooth dark ${inter.variable} ${spaceGrotesk.variable}`}
            suppressHydrationWarning
        >
            <head>
                {/* Read persisted accent theme from localStorage and apply
                    it to <html> before React hydrates to prevent FOUC. */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `(function(){try{var t=localStorage.getItem('accent-theme');var v=['glass','aurora','sunset','plum'];document.documentElement.dataset.theme=v.indexOf(t)>-1?t:'${DEFAULT_THEME}';}catch(e){document.documentElement.dataset.theme='${DEFAULT_THEME}';}})();`,
                    }}
                />
                <PersonJsonLd />
                <WebSiteJsonLd />
                <ProfilePageJsonLd />
            </head>
            <body
                className={`${inter.className} bg-[#f5f7fb] text-slate-900 relative pt-28 sm:pt-32 dark:bg-[#07091a] dark:text-slate-100 antialiased overflow-x-hidden`}
            >
                {/* Animated mesh background (orbs drift, blurred) */}
                <div className="mesh-bg" aria-hidden="true" />

                {/* Static dot grid texture overlay */}
                <div
                    className="dot-grid pointer-events-none fixed inset-0 -z-10 opacity-60 dark:opacity-50"
                    aria-hidden="true"
                />

                <Suspense>
                    <ThemeContextProvider>
                        {children}
                        <Footer />
                        <Toaster />
                        <ThemeSelector />
                    </ThemeContextProvider>
                </Suspense>
                <SpeedInsights />
                <Analytics />
            </body>
        </html>
    );
}
