import Link from "next/link";
import MenuButton from "@/components/chrome/menu-button";
import NavLinks from "@/components/chrome/nav-links";
import ThemeChoice from "@/components/chrome/theme-choice";
import ThemeSwitch from "@/components/chrome/theme-switch";
import { Icon, Patch } from "@/components/ui/icon";
import { chromeCopy } from "@/lib/copy";
import { siteConfig } from "@/lib/config";
import { cvLink, sheetLinks } from "@/lib/navigation";

const PANEL_ID = "site-nav";

/**
 * The header, a Server Component: brand and patch, the five sections by
 * their plain names, the CV link (at every width) and the theme switch
 * (from 960px) are in the static HTML. Below 960px the nav is a popover sheet that opens without
 * JavaScript, with the PDF, the feed and the three-way theme choice;
 * where the Popover API is missing, a fallback Menu link jumps to the
 * footer's nav. Only the current-section mark needs the pathname
 * (components/chrome/nav-links.tsx). Search arrives with the console
 * (PR 16).
 * Ported from the mockup's header (_template.html, site.css 4.2).
 */
export default function SiteHeader() {
    return (
        <header className="site-header" data-print="hide">
            <div className="shell site-header__inner">
                <Link
                    className="brand"
                    href="/"
                    aria-label={chromeCopy.homeLabel}
                >
                    <Patch mark />
                    <span className="brand__name" aria-hidden="true">
                        {siteConfig.author}
                    </span>
                </Link>
                <nav className="nav" aria-label="Main">
                    <div className="nav__panel" id={PANEL_ID} popover="auto">
                        <ul className="nav__list" role="list">
                            <NavLinks />
                        </ul>
                        {/* Shown only inside the menu sheet (< 960px). */}
                        <div className="nav__sheet-extra">
                            <ul className="nav__utility" role="list">
                                {sheetLinks.map(({ href, label }) => (
                                    <li key={href}>
                                        <a href={href}>{label}</a>
                                    </li>
                                ))}
                            </ul>
                            <ThemeChoice instance="sheet" />
                        </div>
                    </div>
                </nav>
                <div className="header-tools">
                    <Link className="header-cv" href={cvLink.href}>
                        {cvLink.label}
                    </Link>
                    <ThemeSwitch />
                    <MenuButton panelId={PANEL_ID} />
                    <a
                        className="nav-toggle nav-toggle--fallback"
                        href="#site-footer-nav"
                    >
                        <Icon name="menu" />
                        <span>{chromeCopy.menu}</span>
                    </a>
                </div>
            </div>
        </header>
    );
}
