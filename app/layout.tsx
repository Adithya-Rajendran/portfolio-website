import { Suspense } from "react";
import "./globals.css";
import { Inter, Space_Grotesk } from "next/font/google";
import { BotIdClient } from "botid/client";
import Footer from "@/components/footer";
import ThemeSelector from "@/components/theme-selector";
import ThemeContextProvider from "@/context/theme-context";
import { Toaster } from "@/components/ui/toaster";
import { DEFAULT_THEME, themes } from "@/lib/themes";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import {
    PersonJsonLd,
    WebSiteJsonLd,
    ProfilePageJsonLd,
} from "@/components/json-ld";
import type { Metadata } from "next";
import type { Viewport } from "next";
import { siteConfig, THEME_COLORS } from "@/lib/config";

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
    metadataBase: new URL(siteConfig.url),
    openGraph: {
        title: siteConfig.title,
        description: siteConfig.description,
        url: siteConfig.url,
        siteName: "Adithya's Portfolio",
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
            className={`!scroll-smooth dark ${inter.variable} ${spaceGrotesk.variable}`}
            suppressHydrationWarning
        >
            <head>
                {/* Read persisted accent theme from localStorage and apply
                    it to <html> before React hydrates to prevent FOUC. */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `(function(){try{var t=localStorage.getItem('accent-theme');var v=${JSON.stringify(themes.map((t) => t.id))};document.documentElement.dataset.theme=v.indexOf(t)>-1?t:'${DEFAULT_THEME}';}catch(e){document.documentElement.dataset.theme='${DEFAULT_THEME}';}})();`,
                    }}
                />
                {/* Vercel BotID — protects the contact form server action.
                    The form on /portfolio submits via POST to the same
                    page URL; this attaches the BotID challenge response
                    so checkBotId() in actions/sendEmail.ts can verify. */}
                <BotIdClient
                    protect={[{ path: "/portfolio", method: "POST" }]}
                />
                <PersonJsonLd />
                <WebSiteJsonLd />
                <ProfilePageJsonLd />
            </head>
            <body
                className={`${inter.className} bg-canvas text-slate-900 relative pt-28 sm:pt-32 dark:bg-canvas-dark dark:text-slate-100 antialiased overflow-x-hidden`}
            >
                {/* Bypass block for keyboard/switch users (WCAG 2.4.1) */}
                <a
                    href="#main-content"
                    className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[1000] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
                >
                    Skip to content
                </a>

                {/* Liquid-glass SVG filters — referenced only by url(#id)
                    from globals.css. #glass-liquid warps the backdrop orbs
                    into organic shapes; #glass-refract lenses the backdrop
                    through the floating chrome (Chromium). Hidden, 0×0. */}
                <svg
                    aria-hidden="true"
                    width="0"
                    height="0"
                    style={{ position: "absolute" }}
                >
                    <defs>
                        <filter
                            id="glass-liquid"
                            x="-20%"
                            y="-20%"
                            width="140%"
                            height="140%"
                            colorInterpolationFilters="sRGB"
                        >
                            <feTurbulence
                                type="fractalNoise"
                                baseFrequency="0.008 0.012"
                                numOctaves={2}
                                seed={7}
                                result="n"
                            />
                            <feGaussianBlur
                                in="n"
                                stdDeviation="1.5"
                                result="nb"
                            />
                            <feDisplacementMap
                                in="SourceGraphic"
                                in2="nb"
                                scale={68}
                                xChannelSelector="R"
                                yChannelSelector="G"
                            />
                        </filter>
                        <filter
                            id="glass-refract"
                            x="-15%"
                            y="-15%"
                            width="130%"
                            height="130%"
                            colorInterpolationFilters="sRGB"
                        >
                            <feTurbulence
                                type="fractalNoise"
                                baseFrequency="0.014 0.014"
                                numOctaves={2}
                                seed={11}
                                result="n"
                            />
                            <feGaussianBlur
                                in="n"
                                stdDeviation="0.7"
                                result="nb"
                            />
                            <feDisplacementMap
                                in="SourceGraphic"
                                in2="nb"
                                scale={22}
                                xChannelSelector="R"
                                yChannelSelector="G"
                            />
                        </filter>
                    </defs>
                </svg>

                {/* Liquid-glass backdrop: colour wash + drifting refracted
                    orbs (.mesh-bg), then the frosted glass grain (.bg-grain) */}
                <div className="mesh-bg" aria-hidden="true" />
                <div className="bg-grain" aria-hidden="true" />

                <Suspense>
                    <ThemeContextProvider>
                        {children}
                        <Footer />
                        <ThemeSelector />
                        <Toaster />
                    </ThemeContextProvider>
                </Suspense>
                <SpeedInsights />
                <Analytics />
            </body>
        </html>
    );
}
