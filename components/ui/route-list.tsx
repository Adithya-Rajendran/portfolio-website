import Link from "next/link";
import { Icon } from "@/components/ui/icon";

/**
 * Link rows (contract §4, extracted from the 404's `.los-routes`): a
 * numbered hairline row per destination, its themed name over its plain
 * name (or the plain name alone), one line about it and an arrow; the
 * whole row is the link. Rows without numbers (profile links) drop the
 * number column.
 */

interface RouteItem {
    /** Stable React key. */
    key: string;
    href: string;
    num?: string;
    themed?: string;
    plain: string;
    blurb?: string | null;
    /** Opens another site in a new tab. */
    external?: boolean;
}

export default function RouteList({
    items,
    columns = 1,
    label,
    labelledBy,
    className,
}: {
    items: readonly RouteItem[];
    /** Rows across from 600px (2) and 960px (3). */
    columns?: 1 | 2 | 3;
    label?: string;
    labelledBy?: string;
    className?: string;
}) {
    if (!items.length) return null;
    const classes = [
        "route-list",
        columns > 1 && `route-list--${columns}`,
        items.every((item) => !item.num) && "route-list--plain",
        className,
    ]
        .filter(Boolean)
        .join(" ");
    return (
        <nav
            className={classes}
            aria-label={label}
            aria-labelledby={labelledBy}
        >
            <ol role="list">
                {items.map((item) => {
                    const content = (
                        <>
                            {item.num ? (
                                <span
                                    className="route-row__num"
                                    aria-hidden="true"
                                >
                                    {item.num}
                                </span>
                            ) : null}
                            <span className="route-row__name">
                                {item.themed ? (
                                    <span className="route-row__themed">
                                        {item.themed}
                                        <span className="sr-only">, </span>
                                    </span>
                                ) : null}
                                <span className="route-row__plain">
                                    {item.plain}
                                </span>
                            </span>
                            {item.blurb ? (
                                <span className="route-row__blurb">
                                    <span className="sr-only">: </span>
                                    {item.blurb}
                                </span>
                            ) : null}
                            <Icon
                                name={item.external ? "external" : "arrow"}
                                className="route-row__arrow"
                            />
                        </>
                    );
                    return (
                        <li key={item.key}>
                            {item.external ? (
                                <a
                                    className="route-row"
                                    href={item.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {content}
                                </a>
                            ) : (
                                <Link className="route-row" href={item.href}>
                                    {content}
                                </Link>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
