import SectionTag from "@/components/ui/section-tag";
import type { OrnamentName } from "@/components/ui/icon";

/**
 * One page head per page (the mockup's `.page-head`): the tag row (an
 * ornament, the section's small themed tag, a hairline and an optional
 * meta), the plain title as the page's only h1, and an optional serif
 * intro. The tag is secondary: the title alone names the page ("Writing",
 * not "Flight Log"). `split` sets the title on the left half and the
 * intro and actions on the right from 960px (`.page-head--split`).
 * `figure` is a decorative drawing beside the head (`.page-head--figure`):
 * at the title's right on phones, 4 of 12 columns from 960px. Actions go
 * in children, wrapped in `.page-head__actions`.
 */
export default function PageHead({
    ornament,
    tag,
    title,
    titleId,
    meta,
    intro,
    split = false,
    figure,
    className,
    children,
}: {
    ornament?: OrnamentName;
    /** The section's themed name, or a designation ("Loss of signal ·
     *  404"): a small label above the title. */
    tag?: string;
    /** The h1: the page's plain name. */
    title: string;
    titleId?: string;
    meta?: React.ReactNode;
    intro?: React.ReactNode;
    split?: boolean;
    /** A decorative drawing beside the head; hidden from assistive tech. */
    figure?: React.ReactNode;
    className?: string;
    children?: React.ReactNode;
}) {
    return (
        <header
            className={[
                "page-head",
                split && "page-head--split",
                figure && "page-head--figure",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <SectionTag as="p" ornament={ornament} meta={meta}>
                {tag ? <span className="page-head__tag">{tag}</span> : null}
            </SectionTag>
            <h1 className="page-head__title" id={titleId}>
                {title}
            </h1>
            {intro ? <p className="page-head__intro">{intro}</p> : null}
            {children}
            {figure ? (
                <div className="page-head__figure" aria-hidden="true">
                    {figure}
                </div>
            ) : null}
        </header>
    );
}
