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
        gradient: "from-indigo-500/15 via-indigo-500/5 to-transparent",
        iconBg:
            "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-400/20",
        accent: "text-indigo-600 dark:text-indigo-300",
    },
    {
        href: "/blogs",
        title: "Blog",
        description:
            "Field notes on cybersecurity, homelabs, infrastructure, and the occasional rabbit hole.",
        cta: "Read writing",
        Icon: PenLine,
        gradient: "from-violet-500/15 via-violet-500/5 to-transparent",
        iconBg:
            "bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-400/20",
        accent: "text-violet-600 dark:text-violet-300",
    },
    {
        href: "/portfolio#contact",
        title: "Get in touch",
        description:
            "Have a project in mind, an open role, or just want to compare notes? Drop me a line.",
        cta: "Start a chat",
        Icon: MailCheck,
        gradient: "from-sky-500/15 via-sky-500/5 to-transparent",
        iconBg:
            "bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-400/20",
        accent: "text-sky-600 dark:text-sky-300",
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
                        gradient,
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
                                className={`pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl bg-gradient-to-br ${gradient}`}
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
