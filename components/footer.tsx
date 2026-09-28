import Link from "next/link";
import MotionToggle from "@/components/chrome/motion-toggle";
import ThemeToggle from "@/components/chrome/theme-toggle";
import Pair from "@/components/ui/pair";
import { Patch } from "@/components/ui/icon";
import { Rev } from "@/components/ui/marks";
import { formatMet, getToday } from "@/lib/clock";
import { chromeCopy } from "@/lib/copy";
import { siteConfig } from "@/lib/config";
import { footerLinks, pairName, primaryNavigation } from "@/lib/navigation";
import { getProfile } from "@/lib/sanity-client";
import { getProfileLink } from "@/lib/profile-content";

/**
 * The footer: the patch and sign, the nav pairs (also the menu's fallback
 * target without the Popover API), plain links, the theme and Hold drift
 * controls, then the document-control strip (G7): the profile's revision
 * date, mission elapsed time since the profile's launch, the copyright and
 * Back to top. Reads only cached data (the profile and a day-cached
 * "today"), so it is part of every page's static shell.
 * Ported from the mockup's footer (_template.html, site.css 4.21).
 */
export default async function Footer() {
    const [today, profile] = await Promise.all([getToday(), getProfile()]);
    const met = formatMet(profile?.launch, today);
    const revised = profile?._updatedAt?.slice(0, 10);
    const social = (["github", "linkedin"] as const)
        .map((kind) => getProfileLink(profile, kind))
        .filter((link) => link !== undefined);
    return (
        <footer className="site-footer" data-print="hide">
            <div className="shell">
                <div className="site-footer__grid">
                    <div>
                        <Patch />
                        <p className="site-footer__sign">
                            {chromeCopy.footerSign}
                        </p>
                    </div>
                    <nav
                        className="site-footer__nav"
                        id="site-footer-nav"
                        aria-label="Footer"
                    >
                        <ul role="list">
                            {primaryNavigation.map((item) => (
                                <li key={item.id}>
                                    <Link
                                        href={item.href}
                                        aria-label={pairName(item)}
                                    >
                                        <Pair
                                            themed={item.themed}
                                            plain={item.plain}
                                        />
                                    </Link>
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
                        <ThemeToggle instance="foot" />
                        <MotionToggle />
                    </div>
                </div>
                <div className="site-footer__base">
                    {revised ? (
                        <Rev date={revised} title={chromeCopy.revTitle} />
                    ) : null}
                    {met ? (
                        <span
                            className="site-footer__met"
                            title={profile?.launch?.event ?? undefined}
                        >
                            <span aria-hidden="true">{met.short}</span>
                            <span className="sr-only">{met.long}</span>
                        </span>
                    ) : null}
                    <span>
                        © {today.slice(0, 4)} {siteConfig.author}
                    </span>
                    <a href="#top" className="link-quiet">
                        {chromeCopy.backToTop} <span aria-hidden="true">↑</span>
                    </a>
                </div>
            </div>
        </footer>
    );
}
