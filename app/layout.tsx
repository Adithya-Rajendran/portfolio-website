import "./globals.css";
import { Inter } from "next/font/google";
import Footer from "@/components/footer";
import ThemeSwitch from "@/components/theme-switch";
import ThemeContextProvider from "@/context/theme-context";
import { Toaster } from "@/components/ui/toaster";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import { PersonJsonLd, WebSiteJsonLd, ProfilePageJsonLd } from "@/components/json-ld";
import type { Metadata } from "next";
import type { Viewport } from "next";
import { siteConfig } from "@/lib/config";

const inter = Inter({ subsets: ["latin"] });

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
        google: "xIlpCrEaBsk8WOUIhIE_UCZMGY91iSuumdsOIoB8I6k",
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
        <html lang="en" className="!scroll-smooth">
            <head>
                <PersonJsonLd />
                <WebSiteJsonLd />
                <ProfilePageJsonLd />
            </head>
            <body
                className={`${inter.className} bg-[#f0fdf4] text-slate-900 relative pt-28 sm:pt-36 dark:bg-[#0a0f1a] dark:text-slate-200`}
            >
                <div className="bg-emerald-200/40 absolute top-[-6rem] -z-10 right-[11rem] h-[31.25rem] w-[31.25rem] rounded-full blur-[10rem] sm:w-[68.75rem] dark:bg-emerald-900/20"></div>
                <div className="bg-teal-100/50 absolute top-[-1rem] -z-10 left-[-35rem] h-[31.25rem] w-[50rem] rounded-full blur-[10rem] sm:w-[68.75rem] md:left-[-33rem] lg:left-[-28rem] xl:left-[-15rem] 2xl:left-[-5rem] dark:bg-cyan-900/15"></div>

                <ThemeContextProvider>
                    {children}
                    <Footer />

                    <Toaster />
                    <ThemeSwitch />
                </ThemeContextProvider>
                <SpeedInsights />
                <Analytics />
            </body>
        </html>
    );
}
