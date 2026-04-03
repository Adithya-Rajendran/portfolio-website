import BlogNav from "@/components/blogs/blog-nav";
import { siteConfig } from "@/lib/config";

export const metadata = {
    title: "Cybersecurity & Cloud Engineering Blog",
    description:
        "Technical blog by Adithya Rajendran covering cybersecurity, cloud engineering, homelabs, penetration testing, and DevOps. Hands-on guides, write-ups, and insights.",
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
