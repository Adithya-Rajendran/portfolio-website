import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Sanity Studio",
    description: "Content management for Adithya's personal website",
    robots: { index: false, follow: false },
    alternates: { canonical: null },
};

/**
 * The Studio sits outside the (site) route group: it gets the root layout
 * only (fonts and BotID), never the site's stylesheets, chrome, JSON-LD or
 * analytics. Inline styles because Tailwind is not loaded here.
 */
export default function StudioLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div style={{ minHeight: "100vh", background: "#ffffff" }}>
            {children}
        </div>
    );
}
