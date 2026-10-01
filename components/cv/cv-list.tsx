import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { CvLink } from "@/lib/cv";

/**
 * The CV rows (contract §4, `.cv-list > .cv-item` in
 * styles/components.css): the log index's grammar, a mono column (the
 * dates and the place) beside the title, its organization, a quiet note
 * (a title's parenthetical, `splitTitle`), a serif line and the facts
 * (the skills and the links, which name themselves, with no key).
 * A row with an `href` is one big link, its other links still live; a
 * link to one of the site's posts (`/blog/…`) opens in place.
 * Directive-free: /resume renders it.
 */

export function CvList({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <ol
            className={className ? `cv-list ${className}` : "cv-list"}
            role="list"
        >
            {children}
        </ol>
    );
}

export function CvItem({
    anchor,
    dates,
    meta,
    title,
    titleAs: Title = "h3",
    href,
    sub,
    note,
    dek,
    lines,
    skills,
    links,
}: {
    /** The row's id, a public fragment (`#cv-…`). */
    anchor?: string;
    dates?: React.ReactNode;
    /** Quieter mono lines under the dates: the place, the length. */
    meta?: readonly (string | null | undefined)[];
    title: string;
    titleAs?: "h3" | "h4";
    /** Makes the whole row a link: a mission file, or a credential's
     *  verification page (opened in a new tab). */
    href?: string;
    sub?: React.ReactNode;
    /** A quiet line under the organization: "Promoted from …". */
    note?: string | null;
    dek?: string | null;
    lines?: readonly string[];
    skills?: readonly string[];
    links?: readonly CvLink[];
}) {
    const quiet = (meta ?? []).filter(Boolean) as string[];
    return (
        <li className="cv-item" id={anchor}>
            <div className="cv-item__aside">
                {dates ? <span className="cv-item__dates">{dates}</span> : null}
                {quiet.map((line) => (
                    <span className="cv-item__meta" key={line}>
                        {line}
                    </span>
                ))}
            </div>
            <div className="cv-item__body">
                <Title className="cv-item__title">
                    {href && /^https?:/.test(href) ? (
                        <a
                            className="stretch"
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {title}
                            <Icon name="external" className="cv-item__ext" />
                        </a>
                    ) : href ? (
                        <Link className="stretch" href={href}>
                            {title}
                        </Link>
                    ) : (
                        title
                    )}
                </Title>
                {sub ? <p className="cv-item__sub">{sub}</p> : null}
                {note ? <p className="cv-item__note">{note}</p> : null}
                {dek ? <p className="cv-item__dek">{dek}</p> : null}
                {lines?.length ? (
                    <ul className="cv-item__lines" role="list">
                        {lines.map((line) => (
                            <li key={line}>{line}</li>
                        ))}
                    </ul>
                ) : null}
                {skills?.length ? (
                    <p className="cv-item__facts">
                        <span className="cv-item__skills">
                            {/* A no-break space keeps each dot with the
                                item before it, so a wrapped line never
                                starts with one. */}
                            {skills.join("\u00a0· ")}
                        </span>
                    </p>
                ) : null}
                {links?.length ? (
                    <p className="cv-item__facts">
                        <span className="cv-item__links">
                            {links.map((link) => (
                                <span className="cv-item__link" key={link.url}>
                                    {/* One of the site's posts opens in
                                        place: no outbound mark. */}
                                    {link.url.startsWith("/") ? (
                                        <Link href={link.url}>
                                            {link.label}
                                        </Link>
                                    ) : (
                                        <a
                                            href={link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            {link.label}
                                            <Icon name="external" />
                                        </a>
                                    )}
                                    {link.host.toLowerCase() !==
                                    link.label.toLowerCase() ? (
                                        <span
                                            className="cv-item__url"
                                            data-print="only"
                                        >
                                            {link.host}
                                        </span>
                                    ) : null}
                                </span>
                            ))}
                        </span>
                    </p>
                ) : null}
            </div>
        </li>
    );
}
