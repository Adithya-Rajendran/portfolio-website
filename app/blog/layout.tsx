import type { Metadata } from "next";
import "@/app/journal-blog.css";
import BlogNav from "@/components/blogs/blog-nav";
import { BLOG_DESCRIPTION, siteConfig } from "@/lib/config";

export const metadata: Metadata = {
    title: "Writing",
    description: BLOG_DESCRIPTION,
    alternates: {
        canonical: `${siteConfig.url}/blog`,
    },
    openGraph: {
        title: `Writing | ${siteConfig.author}`,
        description: BLOG_DESCRIPTION,
        url: `${siteConfig.url}/blog`,
    },
};

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
