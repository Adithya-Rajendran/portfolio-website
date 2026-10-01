"use client";

import { useLayoutEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { movedFragment } from "@/lib/navigation";
import { applyRouteTheme } from "@/lib/prefs";

/**
 * Sets `html[data-route]` to the current path, for route-aware chrome
 * styles; applies the path's theme when the visitor has chosen none (a
 * post follows the OS, lib/theme-boot.ts), as the boot script does on a
 * full load; and sends an old /portfolio fragment on to the page that
 * section moved to (`movedFragment`).
 * Renders nothing. Without JavaScript the attribute is absent.
 */
export default function RouteMarker() {
    const pathname = usePathname();
    const router = useRouter();
    useLayoutEffect(() => {
        const moved = movedFragment(pathname, window.location.hash);
        if (moved) {
            router.replace(moved);
            return;
        }
        const root = document.documentElement;
        root.dataset.route = pathname;
        applyRouteTheme(pathname);
    }, [pathname, router]);
    return null;
}
