"use client";

import { useEffect } from "react";
import LossOfSignal from "@/components/los/loss-of-signal";
import { Button, ButtonLink } from "@/components/ui/button";
import { errorCopy as copy, lossOfSignalCopy } from "@/lib/copy";
import { siteRoutes } from "@/lib/navigation";

/**
 * A render error inside a public page: the Loss of Signal instrument with
 * a Try again button, inside the site chrome. A page that fails while
 * rendering on the server shows it after a client-side navigation, and
 * Try again asks the server again. A fresh page load (a first visit, a
 * reload, a crawler) of a page rendered on demand does not reach it on
 * Next.js 16.3.4: a bare text/plain 500 answers instead (16.4 shows this
 * page), and a failing cached read that both generateMetadata and the page
 * await leaves the request unanswered. The fixture's failing project
 * (`FAILING_PROJECT_FIXTURE`) tests both in tests/e2e/smoke.spec.ts, the
 * fresh load as `test.fail`. An error a layout throws in the browser is
 * app/global-error.tsx's.
 */
export default function Error({
    error,
    retry,
}: {
    error: Error & { digest?: string };
    retry: () => void;
}) {
    useEffect(() => {
        // A server error reaches the browser with its message withheld:
        // its digest names it in the server's log (the Vercel function's).
        console.error(
            error.digest ? `Server error (digest ${error.digest})` : error,
        );
    }, [error]);

    return (
        <LossOfSignal
            page="error"
            tag={copy.tag}
            title={copy.title}
            lead={copy.lead}
            actions={
                <>
                    {/* retry() re-fetches the segment before re-rendering
                        it (Next.js 16.3 error.md); reset() would only
                        re-render. */}
                    <Button variant="primary" icon="reset" onClick={retry}>
                        {copy.retry}
                    </Button>
                    <ButtonLink href={siteRoutes.home}>
                        {lossOfSignalCopy.home}
                    </ButtonLink>
                </>
            }
        />
    );
}
