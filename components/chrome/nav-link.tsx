import Link from "next/link";
import { navCurrent, pairName, type NavItem } from "@/lib/navigation";

/**
 * One themed + plain pair in the header nav. With no `pathname` (the
 * server fallback) it is not marked current; ActiveNavLink passes the
 * client pathname. Directive-free on purpose, so both the server header and
 * the client island can render it. The link is named "Flight Log, Blog":
 * the two names are stacked blocks, so their text alone would be read with
 * a stray space before the comma.
 */
export default function NavLink({
    item,
    pathname,
}: {
    item: NavItem;
    pathname?: string;
}) {
    return (
        <Link
            className="nav__link"
            href={item.href}
            aria-current={navCurrent(pathname, item)}
            aria-label={pairName(item)}
        >
            <span className="nav__themed">{item.themed}</span>
            <span className="nav__plain">{item.plain}</span>
        </Link>
    );
}
