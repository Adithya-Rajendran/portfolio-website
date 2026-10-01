import Link from "next/link";

/**
 * The item head's crumb row (contract §1, extracted from the post's): the
 * section's plain name as a link back to its index, then the row's
 * hairline. Used above a post ("Writing") and a project ("Projects"),
 * whose own title is the page's h1, so the crumb names no item and
 * carries no number. On a phone it is the visible way back.
 */
export default function CrumbRow({
    label,
    href,
    className,
}: {
    /** The section's plain name: "Writing". */
    label: string;
    /** The section's index. */
    href: string;
    className?: string;
}) {
    return (
        <div className={className} data-print="hide">
            <p className="section-tag crumb-row">
                <Link className="crumb-row__home" href={href}>
                    {label}
                </Link>
            </p>
        </div>
    );
}
