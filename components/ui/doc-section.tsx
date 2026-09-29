import SectionTag from "@/components/ui/section-tag";

/**
 * A section of a page (contract §1): the full-width tag row (the plain
 * title as the h2, an optional meta, a hairline), then the body on the
 * shared grid: an optional rail (cols 1–3, sticky from 960px) and the
 * main column (4–12), the reading measure (`prose`, 4–11) or the full
 * width (`wide`). Every page's sections use it, so a section head sits in
 * one place site-wide. The h2's id is `headingId`, else `<id>-h`; `data`
 * adds data attributes to the section (a hook for an island).
 */
export default function DocSection({
    id,
    headingId,
    title,
    meta,
    rail,
    prose = false,
    wide = false,
    className,
    data,
    children,
}: {
    id?: string;
    headingId?: string;
    /** The section's plain name. */
    title: React.ReactNode;
    meta?: React.ReactNode;
    rail?: React.ReactNode;
    prose?: boolean;
    wide?: boolean;
    className?: string;
    data?: Record<`data-${string}`, string | boolean | undefined>;
    children: React.ReactNode;
}) {
    const labelId = headingId ?? `${id}-h`;
    return (
        <section
            className={className ? `section ${className}` : "section"}
            id={id}
            aria-labelledby={labelId}
            {...data}
        >
            <div className="shell">
                <SectionTag className="doc-section__tag" meta={meta}>
                    <h2 className="section-tag__h" id={labelId}>
                        {title}
                    </h2>
                </SectionTag>
                <div className="grid doc-section__body">
                    {rail ? (
                        <div className="g-rail doc-section__rail">{rail}</div>
                    ) : null}
                    <div
                        className={
                            wide ? "g-wide" : prose ? "g-prose" : "g-main"
                        }
                    >
                        {children}
                    </div>
                </div>
            </div>
        </section>
    );
}
