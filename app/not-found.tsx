import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
    return (
        <main className="flex flex-col items-center justify-center px-4 min-h-[70vh] text-center w-full">
            <h1 className="font-display text-5xl sm:text-7xl font-bold mb-6 tracking-tight">
                <span className="text-accent-gradient animate-gradient-text">
                    404
                </span>
            </h1>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-6 text-slate-900 dark:text-white">
                Page Not Found
            </h2>
            <p className="text-lg sm:text-xl text-slate-500 dark:text-slate-400 max-w-[36rem] mx-auto mb-10 leading-relaxed">
                The page you are looking for doesn't exist or has been moved.
            </p>
            <Button asChild size="lg" className="group gap-2">
                <Link href="/">
                    Go back home
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
            </Button>
        </main>
    );
}
