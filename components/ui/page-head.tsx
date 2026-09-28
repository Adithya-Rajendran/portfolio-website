import Pair from "@/components/ui/pair";
import SectionTag from "@/components/ui/section-tag";
import type { OrnamentName } from "@/components/ui/icon";

/**
 * One page head per page (the mockup's `.page-head`): the tag row, the
 * themed title as the page's only h1 with its plain name, and an optional
 * serif intro. The plain name is read after a colon: "Flight Log: Blog".
 * A page with its own title ("Let’s talk.") names both under it, "Comms ·
 * Contact", read after the title's own full stop when it has one.
 * `split` sets the title on the left half and the intro and actions on
 * the right from 960px (`.page-head--split`). `figure` is a decorative
 * drawing beside the head (`.page-head--figure`): at the title's right on
 * phones, 4 of 12 columns from 960px. Actions go in children, wrapped in
 * `.page-head__actions`.
 */
export default function PageHead({
    ornament,
    num,
    sect = true,
    themed,
    plain,
    title = themed,
    titleId,
    meta,
    intro,
    split = false,
    figure,
    className,
    children,
}: {
    ornament?: OrnamentName;
    num?: string;
    sect?: boolean;
    themed: string;
    plain: string;
    /** The h1's text, when it differs from the themed name. */
    title?: string;
    titleId?: string;
    meta?: React.ReactNode;
    intro?: React.ReactNode;
    split?: boolean;
    /** A decorative drawing beside the head; hidden from assistive tech. */
    figure?: React.ReactNode;
    className?: string;
    children?: React.ReactNode;
}) {
    const sub = title === themed ? plain : `${themed} · ${plain}`;
    const separator = /[.!?…]$/.test(title) ? " " : ": ";
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
            <SectionTag
                as="p"
                ornament={ornament}
                num={num}
                sect={sect}
                meta={meta}
            >
                <Pair themed={themed} plain={plain} />
            </SectionTag>
            <h1 className="page-head__title" id={titleId}>
                {title}
                <span className="page-head__plain">
                    <span className="sr-only">{separator}</span>
                    {sub}
                </span>
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
