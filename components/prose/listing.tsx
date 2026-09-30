import CopyButton from "@/components/blogs/copy-button";
import { postCopy as copy } from "@/lib/copy";
import type { ListingInfo } from "@/lib/prose";

/**
 * A numbered code listing (G1): a bar with LISTING n and the file name,
 * then, at its right, the language and a visible Copy button, over the
 * highlighted code. The scroll box is the focusable region, named
 * "Listing 3, Bash, install.sh", so a keyboard can scroll a long line and
 * every listing on a page has its own name. When any listing of a body is
 * longer than the text measure, they all break out wide
 * (`listing--wide`, lib/prose.ts). Highlighted lines arrive from Shiki as
 * `.line-highlight` (lib/highlight-code.ts). Ported from the mockup's
 * `.post-code` (writing.css) and site.css 4.15 Code.
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
        <div
            className={info.wide ? "listing listing--wide" : "listing"}
            data-listing={info.number}
        >
            <div className="listing__bar">
                <span className="listing__num">
                    {copy.listing.num(info.number)}
                </span>
                {info.filename ? (
                    <span className="listing__file" title={info.filename}>
                        {info.filename}
                    </span>
                ) : null}
                <span className="listing__lang">{info.language}</span>
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
