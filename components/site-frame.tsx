"use client";

import { usePathname } from "next/navigation";
import SiteHeader from "@/components/site-header";

/**
 * Public site chrome is intentionally absent from Sanity Studio. This client
 * boundary is rendered inside Suspense in the root layout because pathname
 * discovery can suspend for catch-all routes under Cache Components.
 */
export default function SiteFrame({
    children,
    footer,
}: {
    children: React.ReactNode;
    footer: React.ReactNode;
}) {
    const pathname = usePathname();

    if (pathname.startsWith("/studio")) {
        return <>{children}</>;
    }

    return (
        <>
            <SiteHeader />
            <div className="min-h-[calc(100svh-var(--site-header-height))]">
                {children}
            </div>
            {pathname !== "/" && footer}
        </>
    );
}
