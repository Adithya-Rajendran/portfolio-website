/**
 * The drawing title block (G6), set in the dark: a hairline grid of cells,
 * each a Michroma key over its value (the mockup's `.titleblock`, site.css
 * "Title block (graft 6)"). 12 internal columns from 960px (`span`), 2 on
 * phones (`spanSm`). A value that is not known is not a cell: callers
 * leave it out, and the row's other cells take the width.
 */

export interface TitleBlockCell {
    /** Stable React key. */
    id: string;
    label: string;
    value: React.ReactNode;
    /** Quieter lines under the value, one `dd` each. */
    notes?: readonly React.ReactNode[];
    /** Columns of 12 from 960px. */
    span?: number;
    /** Columns of 2 on phones. */
    spanSm?: 1 | 2;
}

export default function TitleBlock({
    cells,
    className,
}: {
    cells: readonly TitleBlockCell[];
    className?: string;
}) {
    return (
        <dl className={className ? `titleblock ${className}` : "titleblock"}>
            {cells.map((cell) => (
                <div
                    key={cell.id}
                    className="titleblock__cell"
                    style={
                        {
                            "--span": cell.span ?? 3,
                            "--span-sm": cell.spanSm ?? 2,
                        } as React.CSSProperties
                    }
                >
                    <dt>{cell.label}</dt>
                    <dd>{cell.value}</dd>
                    {cell.notes?.map((note, index) => (
                        <dd key={index}>{note}</dd>
                    ))}
                </div>
            ))}
        </dl>
    );
}
