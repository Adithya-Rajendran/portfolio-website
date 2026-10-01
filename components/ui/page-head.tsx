import SectionTag from "@/components/ui/section-tag";

/**
 * One page head per page (the mockup's `.page-head`): the tag row (the
 * section's small themed tag, in Michroma, a hairline and an optional
 * meta), the plain title as the page's only h1, and an optional serif
 * intro. The tag is secondary: the title alone names the page ("Writing",
 * not "Flight Log"). `split` sets the title on the left half and the
 * intro and actions on the right from 960px (`.page-head--split`).
 * Actions go in children, wrapped in `.page-head__actions`.
 */
export default function PageHead({
    tag,
    title,
    titleId,
    meta,
    intro,
    split = false,
    className,
    children,
}: {
    /** The section's themed name, or a designation ("Loss of signal ·
     *  404"): a small label above the title. */
    tag?: string;
    /** The h1: the page's plain name. */
    title: string;
    titleId?: string;
    meta?: React.ReactNode;
    intro?: React.ReactNode;
    split?: boolean;
    className?: string;
    children?: React.ReactNode;
}) {
    return (
        <header
            className={["page-head", split && "page-head--split", className]
                .filter(Boolean)
                .join(" ")}
        >
            <SectionTag as="p" meta={meta}>
                {tag ? <span className="page-head__tag">{tag}</span> : null}
            </SectionTag>
            <h1 className="page-head__title" id={titleId}>
                {title}
            </h1>
            {intro ? <p className="page-head__intro">{intro}</p> : null}
            {children}
        </header>
    );
}
