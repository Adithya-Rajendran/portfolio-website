import Link from "next/link";
import { BsArrowLeft } from "react-icons/bs";

export const metadata = {
    title: "Cybersecurity & Cloud Engineering Blog",
    description:
        "Technical blog by Adithya Rajendran covering cybersecurity, cloud engineering, homelabs, penetration testing, and DevOps. Hands-on guides, write-ups, and insights.",
    alternates: {
        canonical: "https://adithya-rajendran.com/blogs",
    },
};

export default function BlogsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <nav className="fixed top-0 left-0 right-0 z-[999] h-[3.5rem] flex items-center px-6 bg-white/80 border-b border-emerald-200/60 backdrop-blur-[0.5rem] dark:bg-slate-900/80 dark:border-white/8">
                <Link
                    href="/"
                    className="flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800 transition dark:text-slate-400 dark:hover:text-emerald-400"
                >
                    <BsArrowLeft />
                    Home
                </Link>
            </nav>
            <div className="flex-1 py-6 bg-emerald-50/30 dark:bg-white/[0.02] rounded-lg mx-6">
                {children}
            </div>
        </>
    );
}
