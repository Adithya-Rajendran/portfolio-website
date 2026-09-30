import Link from "next/link";
import MotionToggle from "@/components/chrome/motion-toggle";
import ThemeChoice from "@/components/chrome/theme-choice";
import { Icon, Patch } from "@/components/ui/icon";
import { getToday } from "@/lib/clock";
import { chromeCopy } from "@/lib/copy";
import { siteConfig } from "@/lib/config";
import { footerLinks, primaryNavigation } from "@/lib/navigation";
import { getProfile } from "@/lib/sanity-client";
import { getProfileLink } from "@/lib/profile-content";

/**
 * The footer (contract §6): the patch, the sections by their plain names
 * (also the menu's fallback target without the Popover API), plain links
 * (CV, RSS, GitHub, LinkedIn), the theme choice (from 960px; below it the
 * menu sheet carries it) and Pause motion (on home the hero carries it,
 * beside the starfield), then the strip: the copyright, the one place
 * the footer names the owner, the colophon (how the site is made, with
 * its source) and Back to top. No date: a revision
 * belongs to the document it revises (a mission file, the CV), not to
 * every page. Reads only cached data (the profile and a day-cached
 * "today"), so it is part of every page's static shell.
 */
export default async function Footer() {
    const [today, profile] = await Promise.all([getToday(), getProfile()]);
    const name = profile?.name?.trim() || siteConfig.author;
    const social = (["github", "linkedin"] as const)
        .map((kind) => getProfileLink(profile, kind))
        .filter((link) => link !== undefined);
    return (
        <footer className="site-footer" data-print="hide">
            <div className="shell">
                <div className="site-footer__grid">
                    <Patch />
                    <nav
                        className="site-footer__nav"
                        id="site-footer-nav"
                        aria-label="Footer"
                    >
                        <ul role="list">
                            {primaryNavigation.map((item) => (
                                <li key={item.id}>
                                    <Link href={item.href}>{item.plain}</Link>
                                </li>
                            ))}
                        </ul>
                    </nav>
                    <ul className="site-footer__links" role="list">
                        {footerLinks.map(({ href, label }) => (
                            <li key={href}>
                                <a href={href}>{label}</a>
                            </li>
                        ))}
                        {social.map((link) => (
                            <li key={link.url}>
                                <a
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {link.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                    <div className="site-footer__controls">
                        <ThemeChoice instance="foot" />
                        <MotionToggle />
                    </div>
                </div>
                <div className="site-footer__base">
                    <span>
                        © {today.slice(0, 4)} {name}
                    </span>
                    <span className="site-footer__colophon">
                        {chromeCopy.colophon}
                        <span aria-hidden="true"> · </span>
                        <a
                            href={siteConfig.source}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {chromeCopy.source}
                        </a>
                    </span>
                    <a href="#top" className="link-quiet">
                        {chromeCopy.backToTop}
                        <Icon name="arrow-up" className="icon--sm" />
                    </a>
                </div>
            </div>
        </footer>
    );
}
