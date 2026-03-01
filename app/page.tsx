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

function SkillCard({
    icon,
    title,
    skills,
    variant,
    accentColor,
    bgColor,
    iconBorder,
}: {
    icon: React.ReactNode;
    title: string;
    skills: readonly string[];
    variant: "cyber" | "cyan" | "violet";
    accentColor: string;
    bgColor: string;
    iconBorder: string;
}) {
    return (
        <div className="rounded-xl border border-emerald-200 bg-white p-6 hover:shadow-md hover:shadow-emerald-100 transition-shadow dark:border-white/8 dark:bg-white/[0.03] dark:hover:shadow-none">
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${bgColor} ${accentColor} border ${iconBorder} mb-4`}>
                {icon}
            </div>
            <h3 className={`font-semibold mb-4 ${accentColor}`}>{title}</h3>
            <div className="flex flex-wrap gap-2">
                {skills.map((skill, i) => (
                    <Badge key={i} variant={variant} className="text-xs">
                        {skill}
                    </Badge>
                ))}
            </div>
        </div>
    );
}
