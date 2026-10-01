/** A short name in capitals joined by a hyphen: MS-01, TF-IDF, AES-256. */
const HYPHENATED = /\b[A-Z]{1,5}-[A-Z0-9][A-Za-z0-9]*\b/g;

/**
 * Copy whose short hyphenated names stay whole (MS-01, TF-IDF): a hyphen
 * is a break opportunity, and a line that ends on "MS-" reads as a slip.
 * Each name is a `.keep-whole` span (no wrap) rather than U+2011, which
 * the faces may not carry. For a project's summary, brief and highlights.
 */
export default function KeepWhole({ text }: { text: string }) {
    const parts: React.ReactNode[] = [];
    let last = 0;
    for (const match of text.matchAll(HYPHENATED)) {
        parts.push(
            text.slice(last, match.index),
            <span className="keep-whole" key={match.index}>
                {match[0]}
            </span>,
        );
        last = match.index + match[0].length;
    }
    if (!parts.length) return text;
    parts.push(text.slice(last));
    return <>{parts}</>;
}
