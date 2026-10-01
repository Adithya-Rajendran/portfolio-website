"use client";

import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
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
 * "Search the site" with the missed address typed in.
 */
export default function NotFoundActions() {
    const section = lostSection(useRequestedPath());
    return (
        <ButtonLink href={section?.href ?? siteRoutes.home} variant="primary">
            {section ? copy.index[section.id] : copy.home}
        </ButtonLink>
    );
}

/** "Let me know": Hello, with the 404's missed address in the message. */
export function ReportLink({ missed }: { missed: boolean }) {
    const path = useRequestedPath();
    return (
        <Link href={missed ? reportHref(path) : contactHref("hello")}>
            {copy.reportLink}
        </Link>
    );
}
