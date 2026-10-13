import MenuButton from "@/components/chrome/menu-button";
import NavLinks from "@/components/chrome/nav-links";
import SiteLink from "@/components/chrome/site-link";
import ThemeChoice from "@/components/chrome/theme-choice";
import ThemeSwitch from "@/components/chrome/theme-switch";
import { Patch } from "@/components/ui/icon";
import { chromeCopy } from "@/lib/copy";
import { siteConfig } from "@/lib/config";
import { contactLink, cvLink } from "@/lib/navigation";

const PANEL_ID = "site-nav";

/**
 * The header, a Server Component: brand and patch, the five sections by
 * their plain names, Contact and CV in the bar below 960px (where the nav
 * is in the sheet; from 960px the nav's Experience is the way to the CV)
 * and the theme switch (from 960px) are in the static HTML. Below 960px
 * the nav is a popover sheet that opens without JavaScript, with the
 * three-way theme choice. Only the current-section mark needs the
 * pathname (components/chrome/nav-links.tsx). Search arrives with the
 * console (PR 16). `plainLinks`: every link a plain <a href> (the global
 * 404, components/chrome/site-link.tsx).
 * Ported from the mockup's header (_template.html, site.css 4.2).
 */
export default function SiteHeader({
    plainLinks = false,
}: {
    plainLinks?: boolean;
}) {
    return (
        <header className="site-header" data-print="hide">
            <div className="shell site-header__inner">
                <SiteLink
                    className="brand"
                    href="/"
                    aria-label={chromeCopy.homeLabel}
                    plain={plainLinks}
                >
                    <Patch mark />
                    <span className="brand__name" aria-hidden="true">
                        {siteConfig.author}
                    </span>
                </SiteLink>
                <nav className="nav" aria-label="Main">
                    <div className="nav__panel" id={PANEL_ID} popover="auto">
                        <ul className="nav__list" role="list">
                            <NavLinks plain={plainLinks} />
                        </ul>
                        {/* Shown only inside the menu sheet (< 960px). */}
                        <div className="nav__sheet-extra">
                            <ThemeChoice />
                        </div>
                    </div>
                </nav>
                <div className="header-tools">
                    {/* Below 960px only, where the nav is in the sheet. */}
                    <SiteLink
                        className="header-cv"
                        href={contactLink.href}
                        plain={plainLinks}
                    >
                        {contactLink.label}
                    </SiteLink>
                    <SiteLink
                        className="header-cv"
                        href={cvLink.href}
                        plain={plainLinks}
                    >
                        {cvLink.label}
                    </SiteLink>
                    <ThemeSwitch />
                    <MenuButton panelId={PANEL_ID} />
                </div>
            </div>
        </header>
    );
}
