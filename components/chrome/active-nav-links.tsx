"use client";

import { usePathname } from "next/navigation";
import NavLinks from "@/components/chrome/nav-links";

/** The primary navigation with the current section marked `aria-current`. */
export default function ActiveNavLinks() {
    const pathname = usePathname();
    return <NavLinks pathname={pathname} />;
}
