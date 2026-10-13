import SiteLink from "@/components/chrome/site-link";
import { navCurrent, type NavItem } from "@/lib/navigation";

/**
 * One section in the header nav, by its plain name. With no `pathname`
 * (the server fallback) it is not marked current; ActiveNavLink passes
 * the client pathname; `plain` makes it a plain <a href> (the global
 * 404, SiteLink). Directive-free on purpose, so both the server header
 * and the client island can render it.
 */
export default function NavLink({
    item,
    pathname,
    plain = false,
}: {
    item: NavItem;
    pathname?: string;
    plain?: boolean;
}) {
    return (
        <SiteLink
            className="nav__link"
            href={item.href}
            aria-current={navCurrent(pathname, item)}
            plain={plain}
        >
            {item.plain}
        </SiteLink>
    );
}
