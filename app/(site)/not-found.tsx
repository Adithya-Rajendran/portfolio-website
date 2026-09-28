import type { Metadata } from "next";
import NotFoundContent from "@/components/not-found-content";

export const metadata: Metadata = {
    title: "Page not found",
    robots: { index: false, follow: false },
    alternates: { canonical: null },
};

/** notFound() inside a public page renders here, inside the site chrome. */
export default function NotFound() {
    return <NotFoundContent />;
}
