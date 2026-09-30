/**
 * A head's tag row: name · meta, then a hairline to the edge (the
 * mockup's `.section-tag`). The name is passed as children: an
 * `<h2 className="section-tag__h">` with a section's plain name inside a
 * page, or a page's small themed tag in a page head. There are no section
 * numbers: a heading's words are its name.
 */
export default function SectionTag({
    meta,
    as: Tag = "div",
    className,
    children,
}: {
    meta?: React.ReactNode;
    as?: "div" | "p";
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <Tag className={className ? `section-tag ${className}` : "section-tag"}>
            {children}
            {meta ? <span className="section-tag__meta">{meta}</span> : null}
        </Tag>
    );
}
