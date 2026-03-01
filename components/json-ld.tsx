export function PersonJsonLd() {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Person",
        name: "Adithya Rajendran",
        url: "https://adithya-rajendran.com",
        image: "https://adithya-rajendran.com/og-image.jpg",
        jobTitle: "Cloud Field Engineer",
        worksFor: {
            "@type": "Organization",
            name: "Canonical",
        },
        alumniOf: {
            "@type": "CollegeOrUniversity",
            name: "University of California, Santa Cruz",
        },
        sameAs: [
            "https://linkedin.com/in/adithya-rajendran",
            "https://github.com/Adithya-Rajendran",
            "https://app.hackthebox.com/profile/514798",
            "https://tryhackme.com/p/Cagmas",
        ],
        knowsAbout: [
            "Cybersecurity",
            "Cloud Engineering",
            "OpenStack",
            "Kubernetes",
            "AWS",
            "Penetration Testing",
            "Network Security",
            "DevOps",
            "Next.js",
            "Python",
        ],
        description:
            "Cloud Field Engineer at Canonical specializing in cloud infrastructure, cybersecurity, and DevOps. AWS Certified Solutions Architect and CompTIA Security+ certified.",
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
    );
}

export function WebSiteJsonLd() {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Adithya Rajendran - Portfolio & Blog",
        url: "https://adithya-rajendran.com",
        description:
            "Personal portfolio and cybersecurity blog by Adithya Rajendran, Cloud Field Engineer at Canonical.",
        author: {
            "@type": "Person",
            name: "Adithya Rajendran",
        },
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
        author: {
            "@type": "Person",
            name: "Adithya Rajendran",
            url: "https://adithya-rajendran.com",
        },
        publisher: {
            "@type": "Person",
            name: "Adithya Rajendran",
        },
        mainEntityOfPage: {
            "@type": "WebPage",
            "@id": `https://adithya-rajendran.com/blogs/${slug}`,
        },
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
    );
}
