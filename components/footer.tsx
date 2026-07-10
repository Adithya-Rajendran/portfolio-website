import Link from "next/link";
import { cacheLife } from "next/cache";
import { FaGithub, FaLinkedin, FaXTwitter, FaYoutube } from "react-icons/fa6";
import { MapPin } from "lucide-react";
import { siteConfig } from "@/lib/config";
import NewsletterSignupForm from "@/components/newsletter/signup-form";

// Under cacheComponents, new Date() is illegal in an uncached prerender —
// the copyright year gets its own daily-refreshed cache scope instead.
async function getYear(): Promise<number> {
    "use cache";
    cacheLife({ stale: 86400, revalidate: 86400, expire: 31536000 });
    return new Date().getFullYear();
}

const navLinks = [
    { href: "/", label: "Home" },
    { href: "/portfolio", label: "Portfolio" },
    { href: "/blogs", label: "Blog" },
    { href: "/blogs/archive", label: "Archive" },
    { href: "/portfolio#contact", label: "Contact" },
];

const portfolioLinks = [
    { href: "/about", label: "About" },
    { href: "/portfolio#experience", label: "Experience" },
    { href: "/portfolio#projects", label: "Projects" },
    { href: "/portfolio#skills", label: "Skills" },
    { href: "/portfolio#certs", label: "Certifications" },
];

const socialLinks = [
    {
        href: siteConfig.profiles.linkedin,
        label: "LinkedIn",
        Icon: FaLinkedin,
    },
    {
        href: siteConfig.profiles.github,
        label: "GitHub",
        Icon: FaGithub,
    },
    {
        href: siteConfig.profiles.x,
        label: "X",
        Icon: FaXTwitter,
    },
    {
        href: siteConfig.profiles.youtube,
        label: "YouTube",
        Icon: FaYoutube,
    },
].filter((link) => link.href !== "");

export default async function Footer() {
    const year = await getYear();

    return (
        <footer className="relative mt-28 sm:mt-36">
            <div className="os-card border-t border-x-0 border-b-0 rounded-none">
                <div className="mx-auto max-w-6xl px-6 sm:px-8 py-14 sm:py-16">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-10">
                        <div className="col-span-2 sm:col-span-2">
                            <Link
                                href="/"
                                className="inline-flex items-center gap-2 font-display text-xl font-semibold tracking-tight"
                            >
                                <span className="text-accent-gradient">
                                    Adithya
                                </span>
                                <span className="text-slate-700 dark:text-slate-200">
                                    Rajendran
                                </span>
                            </Link>
                            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                                Cloud engineer. Cybersecurity practitioner,
                                infrastructure tinkerer, and writer.
                            </p>
                            <div className="mt-5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <MapPin className="w-3.5 h-3.5 text-accent opacity-80" />
                                <span>{siteConfig.location}</span>
                            </div>

                            <div className="mt-7 max-w-xs">
                                <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 mb-3">
                                    Newsletter
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
                                    Biweekly deep-dives, straight to your inbox.
                                    Free, no spam.
                                </p>
                                <NewsletterSignupForm variant="footer" />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 mb-4">
                                Sitemap
                            </h3>
                            <ul className="space-y-2.5">
                                {navLinks.map((link) => (
                                    <li key={link.href}>
                                        <Link
                                            href={link.href}
                                            className="text-sm text-slate-600 hover:text-accent dark:text-slate-400 transition-colors"
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                                <li>
                                    <a
                                        href="/feed.xml"
                                        className="text-sm text-slate-600 hover:text-accent dark:text-slate-400 transition-colors"
                                    >
                                        RSS
                                    </a>
                                </li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 mb-4">
                                Portfolio
                            </h3>
                            <ul className="space-y-2.5">
                                {portfolioLinks.map((link) => (
                                    <li key={link.href}>
                                        <Link
                                            href={link.href}
                                            className="text-sm text-slate-600 hover:text-accent dark:text-slate-400 transition-colors"
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="mt-12 pt-6 border-t border-slate-200/60 dark:border-white/8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <small className="text-xs text-slate-500 dark:text-slate-400">
                            © {year} {siteConfig.author}. All rights reserved.
                        </small>

                        <div className="flex items-center gap-3">
                            {socialLinks.map(({ href, label, Icon }) => (
                                <a
                                    key={href}
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`${label} profile`}
                                    className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-200/70 bg-white/60 text-slate-500 hover:border-accent-soft hover:text-accent dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 transition-colors backdrop-blur-md"
                                >
                                    <Icon className="w-4 h-4" />
                                </a>
                            ))}
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Built with Next.js · TypeScript · Tailwind
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
}
