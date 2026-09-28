import Pair from "@/components/ui/pair";
import SectionTag from "@/components/ui/section-tag";

/**
 * A numbered section of a document page (contract §1): the full-width tag
 * row (§ number, the themed / plain pair as the h2, optional meta), then
 * the body on the shared grid: an optional rail (cols 1–3, sticky from
 * 960px) and the main column (4–12), or the reading measure (`prose`,
 * 4–11). The mission files and the Crew File use it. The h2's id is
 * `<id>-h`.
 */
export default function DocSection({
    id,
    num,
    themed,
    plain,
    meta,
    rail,
    prose = false,
    className,
    children,
}: {
    id: string;
    num: string;
    themed: string;
    plain: string;
    meta?: React.ReactNode;
    rail?: React.ReactNode;
    prose?: boolean;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <section
            className={className ? `section ${className}` : "section"}
            id={id}
            aria-labelledby={`${id}-h`}
        >
            <div className="shell">
                <SectionTag className="doc-section__tag" num={num} meta={meta}>
                    <h2 className="section-tag__h" id={`${id}-h`}>
                        <Pair themed={themed} plain={plain} />
                    </h2>
                </SectionTag>
                <div className="grid doc-section__body">
                    {rail ? (
                        <div className="g-rail doc-section__rail">{rail}</div>
                    ) : null}
                    <div className={prose ? "g-prose" : "g-main"}>
                        {children}
                    </div>
                </div>
            </div>
        </section>
    );
}
