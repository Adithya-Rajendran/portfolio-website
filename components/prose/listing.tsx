import CopyButton from "@/components/blogs/copy-button";
import { postCopy as copy } from "@/lib/copy";
import type { ListingInfo } from "@/lib/prose";

/**
 * A code listing (G1): a bar with one label, the file name, else the
 * language (a file name already implies it; plain text has none), and,
 * at its right, a visible Copy button, over the highlighted code. Its
 * number prints nowhere (premium D3: nothing refers to it); it only
 * keeps the names apart: the scroll box is the focusable region, named
 * "Listing 3, install.sh", so a keyboard can scroll a long line and
 * every listing on a page has its own name. A listing is the text's
 * width: a longer line scrolls inside it, its edge fading where it
 * continues (styles/prose.css), so no listing is wider than the text.
 * Highlighted lines arrive from Shiki as `.line-highlight`
 * (lib/highlight-code.ts). Ported from the mockup's `.post-code`
 * (writing.css) and site.css 4.15 Code.
 */
export default function Listing({
    info,
    code,
    html,
}: {
    info: ListingInfo;
    code: string;
    /** Shiki's markup; without it the code prints as plain text. */
    html?: string;
}) {
    return (
        <div className="listing" data-listing={info.number}>
            <div className="listing__bar">
                {info.caption ? (
                    <span className="listing__name" title={info.caption}>
                        {info.caption}
                    </span>
                ) : null}
                <CopyButton
                    text={code}
                    idle={copy.listing.copy}
                    done={copy.listing.copied}
                    failed={copy.listing.failed}
                    label={copy.listing.copyLabel(info.number)}
                    announceDone={copy.listing.announceCopied(info.number)}
                    announceFailed={copy.listing.announceFailed}
                    className="listing__copy"
                />
            </div>
            {html ? (
                <div
                    className="listing__code"
                    tabIndex={0}
                    role="region"
                    aria-label={info.label}
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            ) : (
                <div
                    className="listing__code"
                    tabIndex={0}
                    role="region"
                    aria-label={info.label}
                >
                    <pre>
                        <code>{code}</code>
                    </pre>
                </div>
            )}
        </div>
    );
}
