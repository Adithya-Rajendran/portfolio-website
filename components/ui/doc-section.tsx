import Pair from "@/components/ui/pair";
import SectionTag from "@/components/ui/section-tag";

/**
 * A numbered section of a page (contract §1): the full-width tag row
 * (§ number, the themed / plain pair as the h2, optional meta), then the
 * body on the shared grid: an optional rail (cols 1–3, sticky from 960px)
 * and the main column (4–12), the reading measure (`prose`, 4–11) or the
 * full width (`wide`). Every page's sections use it, so a section head
 * sits in one place site-wide. The h2's id is `headingId`, else
 * `<id>-h`; `data` adds data attributes to the section (a hook for an
 * island).
 */
export default function DocSection({
    id,
    headingId,
    num,
    themed,
    plain,
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
    num: string;
    themed: string;
    plain: React.ReactNode;
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
                <SectionTag className="doc-section__tag" num={num} meta={meta}>
                    <h2 className="section-tag__h" id={labelId}>
                        <Pair themed={themed} plain={plain} />
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
