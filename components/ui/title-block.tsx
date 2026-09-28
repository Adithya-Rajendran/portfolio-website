/**
 * The drawing title block (G6), set in the dark: a hairline grid of cells,
 * each a Michroma key over its value (the mockup's `.titleblock`, site.css
 * "Title block (graft 6)"). 12 internal columns from 960px (`span`), 2 on
 * phones (`spanSm`). A `blank` cell is the hatched "Intentionally left
 * blank" filler, hidden from assistive technology.
 */

export interface TitleBlockCell {
    /** Stable React key. */
    id: string;
    label?: string;
    value?: React.ReactNode;
    /** A second, quieter line under the value. */
    note?: React.ReactNode;
    /** Columns of 12 from 960px. */
    span?: number;
    /** Columns of 2 on phones. */
    spanSm?: 1 | 2;
    /** An orange rule on top: the cell that matters most. */
    accent?: boolean;
    /** Set the value in DM Mono (dates, numbers). */
    data?: boolean;
    blank?: boolean;
}

export default function TitleBlock({
    cells,
    blankLabel,
    className,
}: {
    cells: readonly TitleBlockCell[];
    /** The words in a blank cell. */
    blankLabel: string;
    className?: string;
}) {
    return (
        <dl className={className ? `titleblock ${className}` : "titleblock"}>
            {cells.map((cell) => {
                const style = {
                    "--span": cell.span ?? 3,
                    "--span-sm": cell.spanSm ?? 2,
                } as React.CSSProperties;
                if (cell.blank) {
                    return (
                        <div
                            key={cell.id}
                            className="titleblock__cell titleblock__cell--blank"
                            style={style}
                            aria-hidden="true"
                        >
                            <span>{blankLabel}</span>
                        </div>
                    );
                }
                return (
                    <div
                        key={cell.id}
                        className={
                            cell.accent
                                ? "titleblock__cell titleblock__cell--accent"
                                : "titleblock__cell"
                        }
                        style={style}
                    >
                        <dt>{cell.label}</dt>
                        <dd
                            className={
                                cell.data ? "titleblock__v--data" : undefined
                            }
                        >
                            {cell.value}
                        </dd>
                        {cell.note ? <dd>{cell.note}</dd> : null}
                    </div>
                );
            })}
        </dl>
    );
}
