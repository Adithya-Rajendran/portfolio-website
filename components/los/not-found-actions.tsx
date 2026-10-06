"use client";

import SiteLink from "@/components/chrome/site-link";
import { buttonClass } from "@/components/ui/button";
import { useRequestedPath } from "@/components/los/requested-path";
import { lossOfSignalCopy as copy } from "@/lib/copy";
import {
    contactHref,
    lostSection,
    reportHref,
    siteRoutes,
} from "@/lib/navigation";

/**
 * The 404's one action follows the missed address: "All writing" under
 * /blog, "All projects" under /portfolio, otherwise Home (and Home on the
 * server, which never knows the address). The console (PR 16) adds
 * "Search the site" with the missed address typed in. `plain` on the
 * global 404, whose links load pages in full (SiteLink).
 */
export default function NotFoundActions({
    plain = false,
}: {
    plain?: boolean;
}) {
    const section = lostSection(useRequestedPath());
    return (
        <SiteLink
            className={buttonClass({ variant: "primary" })}
            href={section?.href ?? siteRoutes.home}
            plain={plain}
        >
            {section ? copy.index[section.id] : copy.home}
        </SiteLink>
    );
}

/** "Let me know": Hello, with the 404's missed address in the message. */
export function ReportLink({
    missed,
    plain = false,
}: {
    missed: boolean;
    plain?: boolean;
}) {
    const path = useRequestedPath();
    return (
        <SiteLink
            href={missed ? reportHref(path) : contactHref("hello")}
            plain={plain}
        >
            {copy.reportLink}
        </SiteLink>
    );
}
