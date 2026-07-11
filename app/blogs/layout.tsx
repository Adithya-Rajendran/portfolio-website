import type { Metadata } from "next";
import BlogNav from "@/components/blogs/blog-nav";
import { BLOG_DESCRIPTION, siteConfig } from "@/lib/config";

export const metadata: Metadata = {
    title: "Blog",
    description: BLOG_DESCRIPTION,
    alternates: {
        canonical: `${siteConfig.url}/blogs`,
    },
    openGraph: {
        title: `Blog | ${siteConfig.author}`,
        description: BLOG_DESCRIPTION,
        url: `${siteConfig.url}/blogs`,
    },
};

export default function BlogsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <BlogNav />
            <div className="flex-1">{children}</div>
        </>
    );
}
