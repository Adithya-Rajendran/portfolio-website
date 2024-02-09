export const metadata = {
    title: "Personal Blogs Homepage",
    description:
        "Join me on my learning journey in cybersecurity, software development, homelabs, and technology. Read along as I share insights, challenges, and discoveries, turning each lesson into a stepping stone towards expertise.",
};

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
