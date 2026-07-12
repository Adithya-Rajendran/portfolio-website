import type { Metadata } from "next";
import BlogNav from "@/components/blogs/blog-nav";
import { BLOG_DESCRIPTION, siteConfig } from "@/lib/config";

export const metadata: Metadata = {
    title: "Blog",
    description: BLOG_DESCRIPTION,
    alternates: {
        canonical: `${siteConfig.url}/blog`,
    },
    openGraph: {
        title: `Blog | ${siteConfig.author}`,
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
        <div className="flex-1">
            <BlogNav />
            {children}
        </div>
    );
}
