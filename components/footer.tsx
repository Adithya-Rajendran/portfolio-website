import MotionToggle from "@/components/chrome/motion-toggle";
import { getToday } from "@/lib/clock";
import { chromeCopy } from "@/lib/copy";
import { siteConfig } from "@/lib/config";
import { getProfile } from "@/lib/sanity-client";
import { getProfileLink } from "@/lib/profile-content";

/** Glued to its neighbours: no line starts or ends on the dot. */
const DOT = " · ";

/**
 * The footer (contract §6): one strip under its hairline. The copyright,
 * the one place the footer names the owner, with GitHub and LinkedIn; the
 * colophon (how the site is made, a sentence, so in sentence case, then
 * its source); and Pause motion (on
 * home the hero carries it, beside the starfield). The sections, CV and
 * the theme are the header's, on screen whenever the footer is. No date:
 * a revision belongs to the document it revises (a mission file, the
 * CV), not to every page. Reads only cached data (the profile and a
 * day-cached "today"), so it is part of every page's static shell.
 */
export default async function Footer() {
    const [today, profile] = await Promise.all([getToday(), getProfile()]);
    const name = profile?.name?.trim() || siteConfig.author;
    const social = (["github", "linkedin"] as const)
        .map((kind) => getProfileLink(profile, kind))
        .filter((link) => link !== undefined);
    return (
        <footer className="site-footer" data-print="hide">
            <div className="shell site-footer__strip">
                <p className="site-footer__own">
                    <span className="site-footer__name">
                        © {today.slice(0, 4)} {name}
                    </span>
                    {social.length ? (
                        <span className="site-footer__social">
                            {social.map((link, index) => (
                                <span key={link.url}>
                                    <span
                                        className={
                                            index
                                                ? undefined
                                                : "site-footer__lead"
                                        }
                                        aria-hidden="true"
                                    >
                                        {DOT}
                                    </span>
                                    <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {link.label}
                                    </a>
                                </span>
                            ))}
                        </span>
                    ) : null}
                </p>
                <p className="site-footer__colophon">
                    <span className="site-footer__made">
                        {chromeCopy.colophon}
                    </span>
                    <span aria-hidden="true">{DOT}</span>
                    <a
                        href={siteConfig.source}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {chromeCopy.source}
                    </a>
                </p>
                <MotionToggle className="site-footer__motion" />
            </div>
        </footer>
    );
}
