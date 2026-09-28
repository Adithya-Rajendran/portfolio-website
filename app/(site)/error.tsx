"use client";

import { useEffect } from "react";
import LossOfSignal from "@/components/los/loss-of-signal";
import { Button, ButtonLink } from "@/components/ui/button";
import { errorCopy as copy, lossOfSignalCopy } from "@/lib/copy";
import { siteRoutes } from "@/lib/navigation";

/**
 * A render error inside a public page: the Loss of Signal instrument with
 * a Try again button, inside the site chrome.
 */
export default function Error({
    error,
    retry,
}: {
    error: Error & { digest?: string };
    retry: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <LossOfSignal
            page="error"
            tag={copy.tag}
            themed={copy.themed}
            plain={copy.plain}
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
