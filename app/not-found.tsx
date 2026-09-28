import type { Metadata } from "next";
import SiteShell from "@/components/chrome/site-shell";
import NotFoundContent from "@/components/not-found-content";

export const metadata: Metadata = {
    title: "Page not found",
    robots: { index: false, follow: false },
    alternates: { canonical: null },
};

/**
 * Unmatched URLs render here, under the root layout only, so this wraps
 * the page in the same server chrome as app/(site)/layout.tsx.
 */
export default function NotFound() {
    return (
        <SiteShell>
            <NotFoundContent />
        </SiteShell>
    );
}
