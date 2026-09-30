import { logCopy as copy } from "@/lib/copy";
import { siteRoutes } from "@/lib/navigation";
import type { ExternalLink } from "@/lib/sanity-client";
import styles from "./follow-links.module.css";

/**
 * How to follow the writing, as one quiet line of text links: "Follow:
 * RSS · LinkedIn" (LinkedIn only when the profile has it). The same line
 * in /blog's head and at the end of an entry, where it replaced the
 * boxed buttons and the Author block that repeated the footer.
 */
export default function FollowLinks({
    linkedIn,
    className,
}: {
    linkedIn?: ExternalLink | null;
    className?: string;
}) {
    return (
        <p
            className={
                className ? `${styles.follow} ${className}` : styles.follow
            }
        >
            {copy.follow} <a href={siteRoutes.feed}>{copy.rss}</a>
            {linkedIn ? (
                <>
                    {" · "}
                    <a
                        href={linkedIn.url}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {linkedIn.label}
                    </a>
                </>
            ) : null}
        </p>
    );
}
