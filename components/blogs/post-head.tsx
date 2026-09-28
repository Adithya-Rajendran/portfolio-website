import Link from "next/link";
import { Ornament } from "@/components/ui/icon";
import { Rev } from "@/components/ui/marks";
import Pair from "@/components/ui/pair";
import { siteConfig } from "@/lib/config";
import { postCopy as copy } from "@/lib/copy";
import { formatEntryDate } from "@/lib/log-index";
import { siteRoutes } from "@/lib/navigation";
import styles from "./post.module.css";

/**
 * The top of an entry (G1): the crumb row (§ 01 · Flight Log / Blog · LOG
 * nnn · its address), then LOG nnn · date · read time · Updated · tags, the
 * title and the standfirst. Kept short, so the first paragraph reaches the
 * first screen. Ported from the mockup's post.html (`.post-crumbrow`,
 * `.post-head`).
 */
export function PostCrumb({
    designation,
    slug,
    className,
}: {
    designation?: string;
    slug: string;
    className?: string;
}) {
    const address = `${new URL(siteConfig.url).host}/blog/${slug}`;
    return (
        <div className={className} data-print="hide">
            <p className={`section-tag ${styles.crumb}`}>
                <Ornament name="wave" />
                <span className="section-tag__num" aria-hidden="true">
                    <span className="sect">§</span>
                    {copy.num}
                </span>
                <Link className={styles.crumbHome} href={siteRoutes.blog}>
                    <Pair themed={copy.themed} plain={copy.plain} />
                </Link>
                <span className="section-tag__meta">
                    {designation ? (
                        <span className={styles.crumbLog}>{designation}</span>
                    ) : null}
                    <span className={styles.crumbAddress}>
                        {designation ? " · " : ""}
                        {address}
                    </span>
                </span>
            </p>
        </div>
    );
}

export function PostHead({
    title,
    description,
    designation,
    publishedAt,
    revisedAt,
    readMinutes,
    tags,
    className,
}: {
    title: string;
    description?: string | null;
    designation?: string;
    publishedAt?: string | null;
    revisedAt?: string | null;
    readMinutes: number | null;
    tags: readonly string[];
    className?: string;
}) {
    const filed = publishedAt?.slice(0, 10) ?? "";
    return (
        <header className={className}>
            <div className={styles.meta}>
                {designation ? (
                    <span className={styles.metaLog}>{designation}</span>
                ) : null}
                {filed ? (
                    <time className={styles.metaData} dateTime={filed}>
                        {formatEntryDate(filed)}
                    </time>
                ) : null}
                {readMinutes ? (
                    <span className={styles.metaData}>
                        {copy.read(readMinutes)}
                    </span>
                ) : null}
                {revisedAt ? (
                    <Rev date={revisedAt.slice(0, 10)} label={copy.updated} />
                ) : null}
                {tags.length > 0 ? (
                    <ul
                        className={`tags ${styles.metaTags}`}
                        aria-label={copy.tags}
                    >
                        {tags.map((tag) => (
                            <li key={tag}>
                                <Link
                                    className="tag"
                                    href={`/blog/tags/${tag}`}
                                >
                                    {tag}
                                </Link>
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>
            <h1 className={styles.title}>{title}</h1>
            {description ? <p className={styles.dek}>{description}</p> : null}
        </header>
    );
}
