import Link from "next/link";
import { Icon } from "@/components/ui/icon";

/**
 * Link rows (contract §4, extracted from the 404's `.los-routes`): a
 * hairline row per destination, its name, one line about it and an
 * arrow; the whole row is the link (a project's References).
 */

interface RouteItem {
    /** Stable React key. */
    key: string;
    href: string;
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
                            <span className="route-row__name">
                                <span className="route-row__plain lit__title">
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
                                className="route-row__arrow lit__arrow"
                            />
                        </>
                    );
                    return (
                        <li key={item.key}>
                            {item.external ? (
                                <a
                                    className="route-row lit"
                                    href={item.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {content}
                                </a>
                            ) : (
                                <Link
                                    className="route-row lit"
                                    href={item.href}
                                >
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
