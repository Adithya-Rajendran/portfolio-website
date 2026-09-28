"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Sets `html[data-route]` to the current path, for route-aware chrome
 * styles (the home hero's clear header, PR 13). Renders nothing. Without
 * JavaScript the attribute is absent and the header is simply opaque.
 */
export default function RouteMarker() {
    const pathname = usePathname();
    useLayoutEffect(() => {
        document.documentElement.dataset.route = pathname;
    }, [pathname]);
    return null;
}
