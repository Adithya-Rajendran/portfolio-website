import BlogNav from "@/components/blogs/blog-nav";
import { BLOG_DESCRIPTION, siteConfig } from "@/lib/config";

export const metadata = {
    title: "Cybersecurity & Cloud Engineering Blog",
    description: BLOG_DESCRIPTION,
    alternates: {
        canonical: `${siteConfig.url}/blogs`,
    },
    openGraph: {
        title: `Cybersecurity & Cloud Engineering Blog | ${siteConfig.author}`,
        description:
            "Technical blog covering cybersecurity, cloud engineering, homelabs, penetration testing, and DevOps. Hands-on guides, write-ups, and insights.",
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
