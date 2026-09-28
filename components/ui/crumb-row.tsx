import Link from "next/link";
import { Ornament, type OrnamentName } from "@/components/ui/icon";
import Pair from "@/components/ui/pair";

/**
 * The item head's crumb row (contract §1, extracted from the post's): the
 * section's number and its themed / plain pair as a link back to the
 * index, then the item itself (its designation and name) and an optional
 * meta at the end of the hairline. Used above a post and a mission file,
 * whose own title is the page's h1.
 */
export default function CrumbRow({
    ornament,
    num,
    themed,
    plain,
    href,
    code,
    name,
    meta,
    metaClassName,
    className,
}: {
    ornament?: OrnamentName;
    num: string;
    themed: string;
    plain: string;
    /** The section's index. */
    href: string;
    /** The item's designation: "MSN-02". */
    code?: string;
    /** The item's short name. */
    name?: string;
    meta?: React.ReactNode;
    metaClassName?: string;
    className?: string;
}) {
    return (
        <div className={className} data-print="hide">
            <p className="section-tag crumb-row">
                {ornament ? <Ornament name={ornament} /> : null}
                <span className="section-tag__num" aria-hidden="true">
                    <span className="sect">§</span>
                    {num}
                </span>
                <Link className="crumb-row__home" href={href}>
                    <Pair themed={themed} plain={plain} />
                </Link>
                {code || name ? (
                    <span className="crumb-row__item">
                        <span className="crumb-row__sep" aria-hidden="true">
                            /
                        </span>
                        {code ? (
                            <span className="crumb-row__code">{code}</span>
                        ) : null}
                        {name ? <span>{name}</span> : null}
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
            </p>
        </div>
    );
}
