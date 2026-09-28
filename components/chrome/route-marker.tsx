"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { headerMode } from "@/lib/navigation";

/**
 * Sets `html[data-route]` to the current path, and `html[data-header]` to
 * the header's mode on it (`solid` on reading pages, lib/navigation.ts),
 * for route-aware chrome styles (the home hero's clear header arrives in
 * PR 13). Renders nothing. Without JavaScript both attributes are absent
 * and the header is simply opaque.
 */
export default function RouteMarker() {
    const pathname = usePathname();
    useLayoutEffect(() => {
        const root = document.documentElement;
        root.dataset.route = pathname;
        const mode = headerMode(pathname);
        if (mode) root.dataset.header = mode;
        else delete root.dataset.header;
    }, [pathname]);
    return null;
}
