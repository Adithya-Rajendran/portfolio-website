import Link from "next/link";
import { BsArrowRight } from "react-icons/bs";
import { FaBriefcase, FaPenNib } from "react-icons/fa";

export default function Home() {
    return (
        <main className="flex flex-col items-center justify-center min-h-[80vh] px-4">
            <div className="text-center mb-16">
                <h1 className="text-5xl sm:text-6xl font-bold mb-4 bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 dark:from-white dark:via-gray-300 dark:to-white bg-clip-text text-transparent">
                    Adithya Rajendran
                </h1>
                <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-[30rem] mx-auto">
                    Cloud Field Engineer · Cybersecurity Enthusiast · Builder
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 w-full max-w-[48rem]">
                <Link
                    href="/portfolio"
                    className="group relative rounded-2xl border border-black/5 bg-gray-100 p-8 sm:p-10 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-violet-500/10 dark:bg-white/5 dark:border-white/10 dark:hover:shadow-violet-500/20 dark:hover:bg-white/10"
                >
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/5 to-indigo-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-violet-500/10 dark:to-indigo-500/10"></div>
                    <div className="relative">
                        <div className="mb-6 inline-flex items-center justify-center w-14 h-14 rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                            <FaBriefcase className="text-2xl" />
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                            Portfolio
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                            Experience, projects, certifications, and skills in
                            cloud engineering and cybersecurity.
                        </p>
                        <span className="inline-flex items-center gap-2 text-violet-700 dark:text-violet-400 font-medium group-hover:gap-3 transition-all">
                            View Portfolio
                            <BsArrowRight className="transition-transform group-hover:translate-x-1" />
                        </span>
                    </div>
                </Link>

                <Link
                    href="/blogs"
                    className="group relative rounded-2xl border border-black/5 bg-gray-100 p-8 sm:p-10 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-amber-500/10 dark:bg-white/5 dark:border-white/10 dark:hover:shadow-amber-500/20 dark:hover:bg-white/10"
                >
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-500/5 to-orange-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-amber-500/10 dark:to-orange-500/10"></div>
                    <div className="relative">
                        <div className="mb-6 inline-flex items-center justify-center w-14 h-14 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            <FaPenNib className="text-2xl" />
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                            Blogs
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                            Insights and write-ups on cybersecurity, homelabs,
                            and technology explorations.
                        </p>
                        <span className="inline-flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium group-hover:gap-3 transition-all">
                            Read Blogs
                            <BsArrowRight className="transition-transform group-hover:translate-x-1" />
                        </span>
                    </div>
                </Link>
            </div>
        </main>
    );
}
