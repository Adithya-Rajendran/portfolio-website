"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import CareerSectionHeading from "@/components/portfolio/section-heading";
import ContactForm from "@/components/contact/contact-form";
import ContactNoScript from "@/components/contact/contact-no-script";
import { useSectionInView } from "@/lib/hooks";
import { contactCopy } from "@/lib/copy";
import { contactHref } from "@/lib/navigation";
import type { TopicOption } from "@/lib/contact";
import type { ExternalLink } from "@/lib/sanity-client";

/**
 * The /portfolio#contact section. Links shared before /contact existed
 * (LinkedIn, the résumé, older posts) point here, and fragments cannot be
 * redirected, so it keeps the `contact` anchor with the same form as
 * /contact, plus links to each contact route there. The page's legacy
 * layout goes with PR 12 (Missions).
 */
export default function Contact({
    links,
    topics,
    linkedIn,
}: {
    links: ExternalLink[];
    topics: readonly TopicOption[];
    linkedIn?: ExternalLink;
}) {
    const { ref } = useSectionInView("Contact");
    return (
        <section
            id="contact"
            ref={ref}
            className="career-section career-contact"
        >
            <CareerSectionHeading
                title={contactCopy.title}
                description={contactCopy.intro}
            />
            <div>
                <div className="js-only">
                    <ContactForm topics={topics} />
                </div>
                <ContactNoScript linkedIn={linkedIn} />
                <div className="career-contact-channels">
                    <span>{contactCopy.portfolioRoutes}</span>
                    {topics.map((topic) => (
                        <Link key={topic.value} href={contactHref(topic.value)}>
                            {topic.label}
                        </Link>
                    ))}
                </div>
                <div className="career-contact-channels">
                    <span>{contactCopy.elsewhereLede}</span>
                    {links.map((link) => (
                        <a
                            key={link._key}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {link.label}
                            <ArrowUpRight size={14} aria-hidden />
                        </a>
                    ))}
                    <a href="/feed.xml">
                        RSS
                        <ArrowUpRight size={14} aria-hidden />
                    </a>
                </div>
            </div>
        </section>
    );
}
