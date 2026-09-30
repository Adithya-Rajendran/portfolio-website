import { OpenToItems } from "@/components/ui/availability";
import TitleBlock, { type TitleBlockCell } from "@/components/ui/title-block";
import { Icon } from "@/components/ui/icon";
import { crewCopy as copy } from "@/lib/copy";
import { crewRecord } from "@/lib/crew";
import type { ProfileData } from "@/lib/sanity-client";

const LABELS = {
    name: copy.name,
    studying: copy.studying,
    previously: copy.previously,
    focus: copy.focus,
    links: copy.links,
} as const;

/**
 * The owner's record as one hairline title block (G6) on About: Name,
 * Studying, Previously, Focus, Links, all in ink. A role is its title,
 * then the organization and the dates, then the title's parenthetical,
 * as on /resume. The cells and their spans come from `crewRecord`
 * (lib/crew.ts); a value the profile leaves empty has no cell. Returns
 * nothing without a profile.
 */
export default function CrewRecord({
    profile,
    className,
}: {
    profile: ProfileData | null;
    className?: string;
}) {
    const cells: TitleBlockCell[] = crewRecord(profile).map((cell) => ({
        id: cell.id,
        label: LABELS[cell.id],
        span: cell.span,
        spanSm: cell.spanSm,
        // The facts each kept whole, so no line ends on a dot; then a
        // title's parenthetical.
        notes: [
            cell.facts?.length ? (
                <span className="open-to">
                    <OpenToItems text={cell.facts.join(" · ")} />
                </span>
            ) : null,
            cell.note,
        ].filter(Boolean),
        value: cell.links ? (
            <span className="titleblock__links">
                {cell.links.map((link) => (
                    <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {link.label}
                        <Icon name="external" />
                    </a>
                ))}
            </span>
        ) : (
            cell.value
        ),
    }));
    if (!cells.length) return null;
    return (
        <div className={className} role="group" aria-label={copy.recordLabel}>
            <TitleBlock cells={cells} />
        </div>
    );
}
