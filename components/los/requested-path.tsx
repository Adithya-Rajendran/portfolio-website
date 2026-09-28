"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
    window.addEventListener("popstate", callback);
    return () => window.removeEventListener("popstate", callback);
}

const getPath = () => window.location.pathname;
const getServerPath = () => null;

/**
 * The address that lost its signal, read from the browser's location. The
 * 404 is one prerendered page for every unknown URL (its server path is
 * `/_not-found`), so the server renders nothing here and the line appears
 * after hydration; without JavaScript it is simply absent. After a
 * client-side navigation, React re-reads the location once the new route
 * has committed.
 */
export default function RequestedPath({ label }: { label: string }) {
    const pathname = useSyncExternalStore(subscribe, getPath, getServerPath);
    if (!pathname) return null;
    return (
        <p className="los-requested">
            <span className="label">{label}</span>
            <code className="los-requested-path">{pathname}</code>
        </p>
    );
}
