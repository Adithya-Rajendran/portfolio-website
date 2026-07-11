import Link from "next/link";
import { cacheLife } from "next/cache";
import { FaGithub, FaLinkedin, FaXTwitter, FaYoutube } from "react-icons/fa6";
import { siteConfig } from "@/lib/config";

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
    { href: "/about", label: "About" },
    { href: "/portfolio#contact", label: "Contact" },
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
        <footer className="relative mt-12 border-t border-slate-200/70 bg-white/45 dark:border-white/[0.07] dark:bg-white/[0.02] sm:mt-16">
            <div className="mx-auto grid w-full max-w-7xl gap-8 px-6 py-9 sm:px-8 sm:py-10 lg:grid-cols-[minmax(14rem,1fr)_auto] lg:items-center">
                <div>
                    <Link
                        href="/"
                        className="inline-flex items-center font-display text-lg font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[rgb(var(--c1))]"
                    >
                        <span className="text-slate-900 dark:text-white">
                            Adithya Rajendran
                        </span>
                        <span className="text-accent">.</span>
                    </Link>
                    <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                        A personal site for projects, notes, and whatever I am
                        curious about next.
                    </p>
                </div>

                <div className="grid gap-5 sm:justify-items-end">
                    <nav aria-label="Footer navigation">
                        <ul className="flex flex-wrap gap-x-5 gap-y-2 font-term text-xs font-medium text-slate-600 dark:text-slate-300">
                            {navLinks.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[rgb(var(--c1))]"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                            <li>
                                <a
                                    href="/feed.xml"
                                    className="transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[rgb(var(--c1))]"
                                >
                                    RSS ↗
                                </a>
                            </li>
                        </ul>
                    </nav>

                    <div className="flex items-center gap-2.5">
                        {socialLinks.map(({ href, label, Icon }) => (
                            <a
                                key={href}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`${label} profile`}
                                className="os-press inline-flex size-9 items-center justify-center rounded-full border border-slate-200/70 bg-white/55 text-slate-600 transition-colors hover:border-accent-soft hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c1))] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400"
                            >
                                <Icon className="size-3.5" aria-hidden />
                            </a>
                        ))}
                        <small className="ml-1 font-term text-[0.65rem] text-slate-500 dark:text-slate-500">
                            © {year} {siteConfig.author}
                        </small>
                    </div>
                </div>
            </div>
        </footer>
    );
}
