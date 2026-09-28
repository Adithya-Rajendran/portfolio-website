import type { Metadata } from "next";
import SiteShell from "@/components/chrome/site-shell";
import { siteConfig } from "@/lib/config";
import { getProfile } from "@/lib/sanity-client";
import { getProfileDescription } from "@/lib/profile-content";
import { FEED_PATH, FEED_TITLE } from "@/lib/feed";

export async function generateMetadata(): Promise<Metadata> {
    const profile = await getProfile();
    const description = getProfileDescription(profile);
    return {
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

/** Every public page renders inside the server-rendered site chrome. */
export default function SiteLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <SiteShell>{children}</SiteShell>;
}
