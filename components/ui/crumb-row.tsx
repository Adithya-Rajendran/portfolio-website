import Link from "next/link";

/**
 * The item head's crumb row (contract §1, extracted from the post's): the
 * section's plain name as a link back to its index, then the item itself
 * (its quiet identifier and its name). Used above a post and a project
 * file, whose own title is the page's h1. The name, where it wraps, takes
 * a line of its own under the section, the separator and the identifier,
 * which keep one line, so no line starts or ends on the separator.
 */
export default function CrumbRow({
    label,
    href,
    code,
    name,
    className,
}: {
    /** The section's plain name: "Writing". */
    label: string;
    /** The section's index. */
    href: string;
    /** The item's quiet identifier: "MSN-02". */
    code?: string;
    /** The item's short name. */
    name?: string;
    className?: string;
}) {
    const sep = (
        <span className="crumb-row__sep" aria-hidden="true">
            /
        </span>
    );
    return (
        <div className={className} data-print="hide">
            <p className="section-tag crumb-row">
                <span className="crumb-row__lead">
                    <Link className="crumb-row__home" href={href}>
                        {label}
                    </Link>
                    {code ? (
                        <span className="crumb-row__item">
                            {sep}
                            <span className="crumb-row__code">{code}</span>
                        </span>
                    ) : null}
                </span>
                {name ? (
                    <span className="crumb-row__item crumb-row__name">
                        {code ? null : sep}
                        <span>{name}</span>
                    </span>
                ) : null}
            </p>
        </div>
    );
}
