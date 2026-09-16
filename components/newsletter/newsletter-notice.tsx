import { siteConfig } from "@/lib/config";

export default function NewsletterNotice() {
    return (
        <aside
            aria-labelledby="journal-follow-heading"
            className="journal-follow"
        >
            <div>
                <p className="journal-eyebrow">Keep the conversation going</p>
                <h2 id="journal-follow-heading">Wonder is better shared.</h2>
                <p>
                    Follow along on LinkedIn, or get new writing in your RSS
                    reader.
                </p>
            </div>
            <div className="journal-follow-links">
                <a
                    href={siteConfig.profiles.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="journal-link"
                >
                    LinkedIn <span aria-hidden>↗</span>
                </a>
                <a href="/feed.xml" className="journal-link">
                    Follow via RSS <span aria-hidden>↗</span>
                </a>
            </div>
        </aside>
    );
}
