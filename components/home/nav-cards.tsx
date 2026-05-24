import Link from "next/link";
import { ArrowRight, Briefcase, PenLine, MailCheck } from "lucide-react";
import RevealOnScroll from "@/components/reveal-on-scroll";

const cards = [
    {
        href: "/portfolio",
        title: "Portfolio",
        description:
            "Experience, projects, certifications, and skills in cloud engineering and cybersecurity.",
        cta: "Explore work",
        Icon: Briefcase,
        // c1 = primary theme color
        wash: "bg-c1-wash",
        iconBg: "bg-c1-soft border-c1-soft text-accent",
        accent: "text-accent",
    },
    {
        href: "/blogs",
        title: "Blog",
        description:
            "Field notes on cybersecurity, homelabs, infrastructure, and the occasional rabbit hole.",
        cta: "Read writing",
        Icon: PenLine,
        // c2 = secondary
        wash: "bg-c2-wash",
        iconBg: "bg-c2-soft border-c2-soft text-c2",
        accent: "text-c2",
    },
    {
        href: "/portfolio#contact",
        title: "Get in touch",
        description:
            "Have a project in mind, an open role, or just want to compare notes? Drop me a line.",
        cta: "Start a chat",
        Icon: MailCheck,
        // c3 = tertiary
        wash: "bg-c3-wash",
        iconBg: "bg-c3-soft border-c3-soft text-c3",
        accent: "text-c3",
    },
];

export default function NavCards() {
    return (
        <RevealOnScroll
            as="section"
            className="w-full max-w-6xl mx-auto px-2 sm:px-6 pb-28"
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {cards.map(
                    ({
                        href,
                        title,
                        description,
                        cta,
                        Icon,
                        wash,
                        iconBg,
                        accent,
                    }) => (
                        <Link
                            key={href}
                            href={href}
                            className="group glass glow-hover relative overflow-hidden rounded-2xl p-7 sm:p-8 flex flex-col"
                        >
                            <div
                                aria-hidden="true"
                                className={`pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl ${wash}`}
                            />

                            <div className="relative flex flex-col h-full">
                                <div
                                    className={`mb-6 inline-flex items-center justify-center w-11 h-11 rounded-xl border ${iconBg}`}
                                >
                                    <Icon className="w-5 h-5" />
                                </div>
                                <h2 className="font-display text-2xl font-semibold mb-2.5 text-slate-900 dark:text-white">
                                    {title}
                                </h2>
                                <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed text-sm sm:text-base flex-1">
                                    {description}
                                </p>
                                <span
                                    className={`inline-flex items-center gap-2 ${accent} font-medium text-sm transition-all group-hover:gap-3`}
                                >
                                    {cta}
                                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                </span>
                            </div>
                        </Link>
                    ),
                )}
            </div>
        </RevealOnScroll>
    );
}
