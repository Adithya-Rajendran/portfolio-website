export default function BlogsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex-1 py-6 bg-gray-100 dark:bg-gray-900 rounded-lg mx-6">
            {children}
        </div>
    );
}
