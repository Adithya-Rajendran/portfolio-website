"use client";

import { usePathname } from "next/navigation";
import NavLink from "@/components/chrome/nav-link";
import type { NavItem } from "@/lib/navigation";

/** A nav link marked `aria-current` when the URL is in its section. */
export default function ActiveNavLink({
    item,
    plain = false,
}: {
    item: NavItem;
    plain?: boolean;
}) {
    const pathname = usePathname();
    return <NavLink item={item} pathname={pathname} plain={plain} />;
}
