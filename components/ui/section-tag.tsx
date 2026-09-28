import { Ornament, type OrnamentName } from "@/components/ui/icon";

/**
 * A section head's tag row: ornament · number · name · meta, then a
 * hairline to the edge (the mockup's `.section-tag`). The number and the
 * ornament are decorative and stay out of the heading's name, so the name
 * is passed as children: an `<h2 className="section-tag__h">` inside a
 * page, or a `<Pair>` in a page head.
 *
 * `num` "01.1" prints "§01.1": the site is one numbered document (G7).
 */
export default function SectionTag({
    ornament,
    num,
    sect = true,
    meta,
    as: Tag = "div",
    className,
    children,
}: {
    ornament?: OrnamentName;
    num?: string;
    /** Prefix the number with a section mark. */
    sect?: boolean;
    meta?: React.ReactNode;
    as?: "div" | "p";
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <Tag className={className ? `section-tag ${className}` : "section-tag"}>
            {ornament ? <Ornament name={ornament} /> : null}
            {num ? (
                <span className="section-tag__num" aria-hidden="true">
                    {sect ? <span className="sect">§</span> : null}
                    {num}
                </span>
            ) : null}
            {children}
            {meta ? <span className="section-tag__meta">{meta}</span> : null}
        </Tag>
    );
}
