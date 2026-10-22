import { postCopy as copy } from "@/lib/copy";
import type { PostHeading } from "@/lib/headings";

/**
 * A long text's contents (G1): its sections by name, unnumbered, each a
 * link to its heading. One component for an entry's rail and its phone
 * box (components/blogs/post-rail.tsx) and a project's essay, so the two
 * read alike. The contents are `nav aria-label="On this page"`, never an
 * `aside` inside `main`; `data-contents` is how PostReader finds their
 * links to mark the section being read. The classes are `.toc…`
 * (styles/components.css), never `.contents`: Tailwind generates that
 * utility (`display: contents`) in a later layer, and it would win.
 */
export default function Contents({
    headings,
    titled = true,
}: {
    headings: readonly PostHeading[];
    /** The "Contents" label over the list; the phone's box has its own. */
    titled?: boolean;
}) {
    return (
        <nav className="toc" aria-label={copy.contentsLabel} data-contents>
            {titled ? (
                <p className="label toc__title">{copy.contents}</p>
            ) : null}
            <ol className="toc__list" role="list">
                {headings.map((heading) => (
                    <li key={heading.key}>
                        <a href={`#${heading.id}`}>{heading.text}</a>
                    </li>
                ))}
            </ol>
        </nav>
    );
}
