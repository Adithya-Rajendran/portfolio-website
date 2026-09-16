import { getProfile } from "@/lib/sanity-client";
import { getProfileLink } from "@/lib/profile-content";

export default async function NewsletterNotice() {
    const linkedin = getProfileLink(await getProfile(), "linkedin");
    return (
        <aside
            aria-labelledby="journal-follow-heading"
            className="journal-follow"
        >
            <div>
                <p className="journal-eyebrow">Keep the conversation going</p>
                <h2 id="journal-follow-heading">Wonder is better shared.</h2>
                <p>
                    {linkedin
                        ? "Follow along on LinkedIn, or get new writing in your RSS reader."
                        : "Get new writing in your RSS reader."}
                </p>
            </div>
            <div className="journal-follow-links">
                {linkedin && (
                    <a
                        href={linkedin.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="journal-link"
                    >
                        LinkedIn <span aria-hidden>↗</span>
                    </a>
                )}
                <a href="/feed.xml" className="journal-link">
                    Follow via RSS <span aria-hidden>↗</span>
                </a>
            </div>
        </aside>
    );
}
