import { Suspense } from "react";
import ActiveNavLink from "@/components/chrome/active-nav-link";
import NavLink from "@/components/chrome/nav-link";
import RouteMarker from "@/components/chrome/route-marker";
import { primaryNavigation } from "@/lib/navigation";

/**
 * The five nav links as list items. Only the current-section mark needs
 * the pathname, which can suspend under Cache Components, so each link is
 * its own small client island in a leaf Suspense whose fallback is the
 * same link unmarked. One boundary per link, not one for the list: React
 * streams a finished boundary of more than ~500 bytes on a long page as a
 * hidden segment that only JavaScript reveals, and the whole list is
 * larger than that. `plain`: plain <a href> links (the global 404).
 */
export default function NavLinks({ plain = false }: { plain?: boolean }) {
    return (
        <>
            {primaryNavigation.map((item) => (
                <li key={item.id}>
                    <Suspense fallback={<NavLink item={item} plain={plain} />}>
                        <ActiveNavLink item={item} plain={plain} />
                    </Suspense>
                </li>
            ))}
            <Suspense fallback={null}>
                <RouteMarker />
            </Suspense>
        </>
    );
}
