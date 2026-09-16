import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Sanity Studio",
    description: "Content management for Adithya's personal website",
    robots: { index: false, follow: false },
    alternates: { canonical: null },
};

export default function StudioLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <div className="min-h-screen bg-white">{children}</div>;
}
