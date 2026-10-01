import type { Metadata } from "next";
import LossOfSignal from "@/components/los/loss-of-signal";
import NotFoundActions from "@/components/los/not-found-actions";
import { lossOfSignalCopy as copy } from "@/lib/copy";
import { notFoundMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = notFoundMetadata;

/**
 * notFound() inside a public page renders here, inside the site chrome.
 * Unmatched URLs render the same page from app/global-not-found.tsx.
 */
export default function NotFound() {
    return (
        <LossOfSignal
            page="not-found"
            tag={copy.tag}
            title={copy.title}
            lead={copy.lead}
            actions={<NotFoundActions />}
            missed
        />
    );
}
