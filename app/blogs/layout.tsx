import Link from "next/link";
import { BsArrowLeft } from "react-icons/bs";

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
        <>
            <nav className="fixed top-0 left-0 right-0 z-[999] h-[3.5rem] flex items-center px-6 bg-white/80 border-b border-black/5 backdrop-blur-[0.5rem] dark:bg-gray-950/75 dark:border-white/10">
                <Link
                    href="/"
                    className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-950 transition dark:text-gray-400 dark:hover:text-gray-200"
                >
                    <BsArrowLeft />
                    Home
                </Link>
            </nav>
            <div className="flex-1 py-6 bg-gray-100 dark:bg-gray-900 rounded-lg mx-6">
                {children}
            </div>
        </>
    );
}
