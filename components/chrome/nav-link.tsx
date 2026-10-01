import Link from "next/link";
import { navCurrent, type NavItem } from "@/lib/navigation";

/**
 * One section in the header nav, by its plain name. With no `pathname`
 * (the server fallback) it is not marked current; ActiveNavLink passes
 * the client pathname. Directive-free on purpose, so both the server
 * header and the client island can render it.
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
        >
            {item.plain}
        </Link>
    );
}
