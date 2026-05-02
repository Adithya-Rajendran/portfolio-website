import { siteConfig } from "@/lib/config";
import { cacheLife } from "next/cache";

export async function SiteJsonLd() {
    "use cache";
    cacheLife("max");

    const person = {
        "@type": "Person",
        "@id": `${siteConfig.url}#person`,
        name: "Adithya Rajendran",
        alternateName: "Adithya",
        url: siteConfig.url,
        image: `${siteConfig.url}/og-image.jpg`,
        jobTitle: "Cloud Field Engineer",
        worksFor: {
            "@type": "Organization",
            name: "Canonical",
            url: "https://canonical.com",
        },
        alumniOf: {
            "@type": "CollegeOrUniversity",
            name: "University of California, Santa Cruz",
        },
        sameAs: siteConfig.socials,
        knowsAbout: [
            "Cloud Engineering",
            "Cybersecurity",
            "OpenStack",
            "Kubernetes",
            "AWS",
            "DevOps",
            "Penetration Testing",
            "Network Security",
        ],
        hasCredential: [
            {
                "@type": "EducationalOccupationalCredential",
                name: "AWS Certified Solutions Architect",
                credentialCategory: "certification",
                recognizedBy: {
                    "@type": "Organization",
                    name: "Amazon Web Services",
                },
            },
            {
                "@type": "EducationalOccupationalCredential",
                name: "CompTIA Security+",
                credentialCategory: "certification",
                recognizedBy: { "@type": "Organization", name: "CompTIA" },
            },
        ],
        description:
            "Cloud Field Engineer at Canonical specializing in cloud infrastructure, cybersecurity, and DevOps. AWS Certified Solutions Architect and CompTIA Security+ certified.",
    };

    const website = {
        "@type": "WebSite",
        "@id": `${siteConfig.url}#website`,
        name: "Adithya Rajendran - Portfolio & Blog",
        url: siteConfig.url,
        description:
            "Personal portfolio and cybersecurity blog by Adithya Rajendran, Cloud Field Engineer at Canonical.",
        author: { "@id": `${siteConfig.url}#person` },
    };

    const profilePage = {
        "@type": "ProfilePage",
        "@id": `${siteConfig.url}#profile`,
        dateCreated: "2024-01-01",
        dateModified: new Date().toISOString().split("T")[0],
        mainEntity: { "@id": `${siteConfig.url}#person` },
    };

    const graph = {
        "@context": "https://schema.org",
        "@graph": [person, website, profilePage],
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
        />
    );
}

export function BlogPostJsonLd({
    title,
    description,
    date,
    slug,
}: {
    title: string;
    description: string;
    date: string;
    slug: string;
}) {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: title,
        description,
        datePublished: date,
        image: `${siteConfig.url}/og-image.jpg`,
        author: {
            "@type": "Person",
            name: "Adithya Rajendran",
            url: siteConfig.url,
        },
        publisher: {
            "@type": "Person",
            name: "Adithya Rajendran",
        },
        mainEntityOfPage: {
            "@type": "WebPage",
            "@id": `${siteConfig.url}/blogs/${slug}`,
        },
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
    );
}
