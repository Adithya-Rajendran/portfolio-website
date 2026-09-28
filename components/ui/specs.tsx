/**
 * A key/value list (contract §4, the mockup's site.css 4.9 `dl.specs`):
 * tier-2 labels in a rail beside their values, one hairline across each
 * row (`dl > div` rows, which HTML allows).
 * Skills on /resume; a mission's specifications from PR 12.
 */

export interface SpecItem {
    /** Stable React key. */
    id: string;
    term: React.ReactNode;
    value: React.ReactNode;
}

export default function Specs({
    items,
    className,
}: {
    items: readonly SpecItem[];
    className?: string;
}) {
    if (!items.length) return null;
    return (
        <dl className={className ? `specs ${className}` : "specs"}>
            {items.map((item) => (
                <div className="specs__row" key={item.id}>
                    <dt>{item.term}</dt>
                    <dd>{item.value}</dd>
                </div>
            ))}
        </dl>
    );
}
