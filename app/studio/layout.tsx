export const metadata = {
    title: "Sanity Studio | Blog CMS",
    description: "Content management studio for blog posts",
};

export default function StudioLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body style={{ margin: 0, padding: 0 }}>{children}</body>
        </html>
    );
}
