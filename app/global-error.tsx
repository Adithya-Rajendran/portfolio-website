"use client";

import "@/app/globals.css";
import { useEffect } from "react";
import ThemeBootScript from "@/components/chrome/theme-boot-script";
import LossOfSignal from "@/components/los/loss-of-signal";
import { Button, ButtonLink } from "@/components/ui/button";
import { siteConfig } from "@/lib/config";
import { errorCopy as copy, lossOfSignalCopy } from "@/lib/copy";
import { fontVariables } from "@/lib/fonts";
import { siteRoutes } from "@/lib/navigation";

/**
 * An error the root layout or the site layout throws, which
 * app/(site)/error.tsx sits inside and cannot catch. Next.js replaces the
 * whole document with this one (its built-in page is unstyled), so, like
 * app/global-not-found.tsx, it repeats the root layout's <html>: the font
 * variables, the theme boot script and the stylesheet, which applies only
 * when this page shows (other routes, the Studio included, preload it).
 * Then the error page's head, Try again and Home.
 * A client component cannot render SiteShell (it reads server data), so
 * there is no header or footer; metadata exports do not apply here, so
 * the title is React's <title>.
 */
export default function GlobalError({
    error,
    retry,
}: {
    error: Error & { digest?: string };
    retry: () => void;
}) {
    useEffect(() => {
        // As app/(site)/error.tsx: a server error's digest names it in the
        // server's log.
        console.error(
            error.digest ? `Server error (digest ${error.digest})` : error,
        );
    }, [error]);

    return (
        <html
            lang="en"
            data-theme="void"
            className={fontVariables}
            suppressHydrationWarning
        >
            <head>
                <ThemeBootScript />
            </head>
            <body>
                <title>{`${copy.title} | ${siteConfig.author}`}</title>
                <main id="main-content" tabIndex={-1}>
                    <LossOfSignal
                        page="error"
                        tag={copy.tag}
                        title={copy.title}
                        lead={copy.lead}
                        actions={
                            <>
                                {/* No icon: the sprite is SiteShell's. */}
                                <Button variant="primary" onClick={retry}>
                                    {copy.retry}
                                </Button>
                                <ButtonLink href={siteRoutes.home}>
                                    {lossOfSignalCopy.home}
                                </ButtonLink>
                            </>
                        }
                    />
                </main>
            </body>
        </html>
    );
}
