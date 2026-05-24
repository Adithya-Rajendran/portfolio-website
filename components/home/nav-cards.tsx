import Link from "next/link";
import { ArrowRight, Briefcase, PenLine, MailCheck } from "lucide-react";
import RevealOnScroll from "@/components/reveal-on-scroll";
import { IconPill } from "@/components/ui/icon-pill";

const cards = [
    {
        href: "/portfolio",
        title: "Portfolio",
        description:
            "Experience, projects, certifications, and skills in cloud engineering and cybersecurity.",
        cta: "Explore work",
        Icon: Briefcase,
        color: "c1" as const,
    },
    {
        href: "/blogs",
        title: "Blog",
        description:
            "Field notes on cybersecurity, homelabs, infrastructure, and the occasional rabbit hole.",
        cta: "Read writing",
        Icon: PenLine,
        color: "c2" as const,
    },
    {
        href: "/portfolio#contact",
        title: "Get in touch",
        description:
            "Have a project in mind, an open role, or just want to compare notes? Drop me a line.",
        cta: "Start a chat",
        Icon: MailCheck,
        color: "c3" as const,
    },
];

export default function NavCards() {
    return (
        <RevealOnScroll
            as="section"
            className="w-full max-w-6xl mx-auto px-4 sm:px-6 pb-28"
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {cards.map(({ href, title, description, cta, Icon, color }) => {
                    const accentClass =
                        color === "c1"
                            ? "text-accent"
                            : color === "c2"
                              ? "text-c2"
                              : "text-c3";
                    return (
                        <Link
                            key={href}
                            href={href}
                            className="group os-card os-hover rounded-3xl p-7 sm:p-8 flex flex-col"
                        >
                            <IconPill icon={Icon} color={color} size="lg" />
                            <h2 className="mt-6 font-display text-2xl font-semibold text-slate-900 dark:text-white">
                                {title}
                            </h2>
                            <p className="mt-2.5 text-slate-600 dark:text-slate-400 leading-relaxed text-sm sm:text-base flex-1">
                                {description}
                            </p>
                            <span
                                className={`mt-6 inline-flex items-center gap-2 ${accentClass} font-medium text-sm transition-all group-hover:gap-3`}
                            >
                                {cta}
                                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                            </span>
                        </Link>
                    );
                })}
            </div>
        </RevealOnScroll>
    );
}
