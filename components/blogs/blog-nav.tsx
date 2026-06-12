"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BlogNav() {
    const pathname = usePathname();
    const isPostPage = pathname !== "/blogs" && pathname.startsWith("/blogs/");

    return (
        <nav className="os-nav fixed top-0 left-0 right-0 z-[999] h-[3.5rem] flex items-center px-6 rounded-none border-x-0 border-t-0">
            <Link
                href={isPostPage ? "/blogs" : "/"}
                className="flex items-center gap-2 text-sm font-medium text-accent hover:opacity-80 transition-opacity"
            >
                <ArrowLeft className="w-4 h-4" />
                {isPostPage ? "Blog" : "Home"}
            </Link>
        </nav>
    );
}
