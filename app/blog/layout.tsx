import type { Metadata } from "next";
import "@/app/journal-blog.css";
import BlogNav from "@/components/blogs/blog-nav";
import { siteConfig } from "@/lib/config";
import { getProfile } from "@/lib/sanity-client";
import { getWritingDescription } from "@/lib/profile-content";

export async function generateMetadata(): Promise<Metadata> {
    const description = getWritingDescription(await getProfile());
    return {
        title: "Writing",
        description,
        alternates: { canonical: `${siteConfig.url}/blog` },
        openGraph: {
            title: `Writing | ${siteConfig.author}`,
            description,
            url: `${siteConfig.url}/blog`,
        },
        twitter: {
            card: "summary_large_image",
            title: `Writing | ${siteConfig.author}`,
            description,
        },
    };
}

export default function BlogsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="journal-blog-layout">
            <BlogNav />
            {children}
        </div>
    );
}
