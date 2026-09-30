import type { Metadata } from "next";
import SiteShell from "@/components/chrome/site-shell";
import { siteConfig } from "@/lib/config";
import { getProfile } from "@/lib/sanity-client";
import { getProfileDescription } from "@/lib/profile-content";
import { feedAlternates } from "@/lib/feed";
import { siteOpenGraph } from "@/lib/site-metadata";

export async function generateMetadata(): Promise<Metadata> {
    const profile = await getProfile();
    const description = getProfileDescription(profile);
    const described = description ? { description } : {};
    return {
        ...described,
        alternates: feedAlternates(siteConfig.url),
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
        openGraph: siteOpenGraph(profile),
        twitter: {
            card: "summary_large_image",
            title: siteConfig.title,
            ...described,
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
