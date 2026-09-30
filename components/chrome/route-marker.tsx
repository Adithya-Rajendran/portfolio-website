"use client";

import { useLayoutEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { headerMode, movedFragment } from "@/lib/navigation";

/**
 * Sets `html[data-route]` to the current path, and `html[data-header]` to
 * the header's mode on it (`solid` on reading pages, lib/navigation.ts),
 * for route-aware chrome styles, and sends an old /portfolio fragment on
 * to the page that section moved to (`movedFragment`). Renders nothing.
 * Without JavaScript both attributes are absent and the header is simply
 * opaque.
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
        const mode = headerMode(pathname);
        if (mode) root.dataset.header = mode;
        else delete root.dataset.header;
    }, [pathname, router]);
    return null;
}
