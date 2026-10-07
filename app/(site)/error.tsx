"use client";

import { useEffect } from "react";
import LossOfSignal from "@/components/los/loss-of-signal";
import { Button, ButtonLink } from "@/components/ui/button";
import { errorCopy as copy, lossOfSignalCopy } from "@/lib/copy";
import { siteRoutes } from "@/lib/navigation";

/**
 * A render error inside a public page: the Loss of Signal instrument with
 * a Try again button, inside the site chrome. An error the site layout or
 * the root layout throws is app/global-error.tsx's. A page that fails
 * while rendering on demand on the server answers a bare "Internal Server
 * Error" instead (Next.js 16.3.4; the fixture's failing project,
 * `FAILING_PROJECT_FIXTURE`, marks it `test.fail` in
 * tests/e2e/smoke.spec.ts), so this shows for a failure in the browser.
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
