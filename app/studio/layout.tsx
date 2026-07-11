export const metadata = {
    title: "Adithya's Site | Sanity Studio",
    description: "Content management for Adithya's personal website",
};

export default function StudioLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <div className="min-h-screen bg-white">{children}</div>;
}
