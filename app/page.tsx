import { HeroSection } from "@/components/hero-section";
import { NavCard } from "@/components/nav-card";
import { Briefcase, PenLine } from "lucide-react";

export default function Home() {
    return (
        <main className="flex flex-col items-center justify-center min-h-dvh px-4 py-16 sm:py-0">
            <HeroSection />

            <nav
                aria-label="Main sections"
                className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 w-full max-w-3xl"
            >
                <NavCard
                    href="/portfolio"
                    icon={Briefcase}
                    title="Portfolio"
                    description="Experience, projects, certifications, and skills in cloud engineering and cybersecurity."
                    cta="View Portfolio"
                    variant="primary"
                    delay="200ms"
                />
                <NavCard
                    href="/blogs"
                    icon={PenLine}
                    title="Blogs"
                    description="Insights and write-ups on cybersecurity, homelabs, and technology explorations."
                    cta="Read Blogs"
                    variant="accent"
                    delay="350ms"
                />
            </nav>
        </main>
    );
}
