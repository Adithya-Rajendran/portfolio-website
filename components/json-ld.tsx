export function PersonJsonLd() {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Person",
        name: "Adithya Rajendran",
        alternateName: "Adithya",
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
            "https://www.linkedin.com/in/adithya-rajendran",
            "https://github.com/Adithya-Rajendran",
            "https://www.credly.com/users/adithya-rajendran",
            "https://app.hackthebox.com/profile/514798",
            "https://tryhackme.com/p/Cagmas",
        ],
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

export function ProfilePageJsonLd() {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        dateCreated: "2024-01-01",
        dateModified: new Date().toISOString().split("T")[0],
        mainEntity: {
            "@type": "Person",
            name: "Adithya Rajendran",
            alternateName: "Adithya",
            url: "https://adithya-rajendran.com",
            image: "https://adithya-rajendran.com/og-image.jpg",
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
            sameAs: [
                "https://www.linkedin.com/in/adithya-rajendran",
                "https://github.com/Adithya-Rajendran",
                "https://www.credly.com/users/adithya-rajendran",
                "https://app.hackthebox.com/profile/514798",
                "https://tryhackme.com/p/Cagmas",
            ],
            hasCredential: [
                {
                    "@type": "EducationalOccupationalCredential",
                    name: "AWS Certified Solutions Architect",
                    credentialCategory: "certification",
                    recognizedBy: { "@type": "Organization", name: "Amazon Web Services" },
                },
                {
                    "@type": "EducationalOccupationalCredential",
                    name: "CompTIA Security+",
                    credentialCategory: "certification",
                    recognizedBy: { "@type": "Organization", name: "CompTIA" },
                },
            ],
        },
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
    );
}
