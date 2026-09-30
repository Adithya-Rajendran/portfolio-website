import Link from "next/link";
import { Ornament, type OrnamentName } from "@/components/ui/icon";

/**
 * The item head's crumb row (contract §1, extracted from the post's): the
 * section's plain name as a link back to its index, then the item itself
 * (its quiet identifier and its name) and an optional meta at the end of
 * the hairline. Used above a post and a project file, whose own title is
 * the page's h1; on the flight (/resume/trajectory) the name is the h1
 * (`heading`), the page's whole head.
 */
export default function CrumbRow({
    ornament,
    label,
    href,
    code,
    name,
    heading = false,
    meta,
    metaClassName,
    className,
}: {
    ornament?: OrnamentName;
    /** The section's plain name: "Writing". */
    label: string;
    /** The section's index. */
    href: string;
    /** The item's quiet identifier: "MSN-02". */
    code?: string;
    /** The item's short name. */
    name?: string;
    /** The name is the page's h1, small, in the crumb's line. */
    heading?: boolean;
    meta?: React.ReactNode;
    metaClassName?: string;
    className?: string;
}) {
    const Row = heading ? "div" : "p";
    return (
        <div className={className} data-print="hide">
            <Row className="section-tag crumb-row">
                {ornament ? <Ornament name={ornament} /> : null}
                <Link className="crumb-row__home" href={href}>
                    {label}
                </Link>
                {code || name ? (
                    <span className="crumb-row__item">
                        <span className="crumb-row__sep" aria-hidden="true">
                            /
                        </span>
                        {code ? (
                            <span className="crumb-row__code">{code}</span>
                        ) : null}
                        {name && heading ? (
                            <h1 className="crumb-row__title">{name}</h1>
                        ) : name ? (
                            <span>{name}</span>
                        ) : null}
                    </span>
                ) : null}
                {meta ? (
                    <span
                        className={
                            metaClassName
                                ? `section-tag__meta ${metaClassName}`
                                : "section-tag__meta"
                        }
                    >
                        {meta}
                    </span>
                ) : null}
            </Row>
        </div>
    );
}
