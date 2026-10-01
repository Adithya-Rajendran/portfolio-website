import { Icon } from "@/components/ui/icon";
import { postCopy as copy } from "@/lib/copy";
import type { NoteInfo } from "@/lib/prose";

/**
 * The numbered notes at the end of an entry (G1). This list is the
 * canonical home of every footnote: the raised number in the text links
 * here, each note links back, and the margin copies beside the text on
 * wide screens are decorative. Without notes, nothing renders.
 */
export default function Footnotes({
    notes,
    className,
}: {
    notes: readonly NoteInfo[];
    className?: string;
}) {
    if (!notes.length) return null;
    return (
        <section
            className={className ? `notes ${className}` : "notes"}
            aria-labelledby="entry-notes"
        >
            <h2 className="notes__title" id="entry-notes">
                {copy.notes.title}
            </h2>
            <ol className="notes__list">
                {notes.map((note) => (
                    <li key={note.id} id={note.id} className="notes__item">
                        <span className="notes__n" aria-hidden="true">
                            {note.number}
                        </span>
                        <p className="notes__text">
                            {note.text}{" "}
                            <a
                                className="notes__back"
                                href={`#${note.refId}`}
                                aria-label={copy.notes.back(note.number)}
                            >
                                <Icon name="arrow-up" />
                            </a>
                        </p>
                    </li>
                ))}
            </ol>
        </section>
    );
}
