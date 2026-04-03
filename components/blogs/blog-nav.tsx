"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BsArrowLeft } from "react-icons/bs";

export default function BlogNav() {
    const pathname = usePathname();
    const isPostPage = pathname !== "/blogs" && pathname.startsWith("/blogs/");

    return (
        <nav className="fixed top-0 left-0 right-0 z-[999] h-[3.5rem] flex items-center px-6 bg-white/80 border-b border-emerald-200/60 backdrop-blur-[0.5rem] dark:bg-slate-900/80 dark:border-white/8">
            <Link
                href={isPostPage ? "/blogs" : "/"}
                className="flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800 transition dark:text-slate-400 dark:hover:text-emerald-400"
            >
                <BsArrowLeft />
                {isPostPage ? "Blog" : "Home"}
            </Link>
        </nav>
    );
}
