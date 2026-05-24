import { Suspense } from "react";
import "./globals.css";
import { Inter } from "next/font/google";
import Footer from "@/components/footer";
import ThemeSwitch from "@/components/theme-switch";
import ThemeContextProvider from "@/context/theme-context";
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

const inter = Inter({ subsets: ["latin"], display: "swap" });

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
        { media: "(prefers-color-scheme: light)", color: "#f0fdf4" },
        { media: "(prefers-color-scheme: dark)", color: "#0a0f1a" },
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
            className="!scroll-smooth dark"
            suppressHydrationWarning
        >
            <head>
                <PersonJsonLd />
                <WebSiteJsonLd />
                <ProfilePageJsonLd />
            </head>
            <body
                className={`${inter.className} bg-[#f0fdf4] text-slate-900 relative pt-28 sm:pt-32 dark:bg-[#0a0f1a] dark:text-slate-200 antialiased`}
            >
                {/* Single soft accent in the top-right. The previous two
                    overlapping blobs felt busy; a single quiet glow keeps
                    the emerald identity without competing with content. */}
                <div
                    className="pointer-events-none fixed top-[-12rem] right-[-12rem] -z-10 h-[40rem] w-[40rem] rounded-full blur-[8rem] bg-emerald-200/30 dark:bg-emerald-500/10"
                    style={{ contain: "paint", willChange: "auto" }}
                    aria-hidden="true"
                />
                <div
                    className="pointer-events-none fixed bottom-[-16rem] left-[-12rem] -z-10 h-[36rem] w-[36rem] rounded-full blur-[8rem] bg-teal-100/30 dark:bg-cyan-500/[0.04]"
                    style={{ contain: "paint", willChange: "auto" }}
                    aria-hidden="true"
                />

                <Suspense>
                    <ThemeContextProvider>
                        {children}
                        <Footer />
                        <Toaster />
                        <ThemeSwitch />
                    </ThemeContextProvider>
                </Suspense>
                <SpeedInsights />
                <Analytics />
            </body>
        </html>
    );
}
