import { Status } from "@/components/ui/marks";

/**
 * The openings in an Open To line ("Summer 2027 internships · Full-time
 * opportunities in 2028"), each kept whole, for a `.open-to` line. The dot
 * before an opening sits in the gap, so where the line wraps it falls at
 * the line's start and is clipped: a wrapped line reads as a list, with no
 * dot left at either end (styles/components.css).
 */
export function OpenToItems({ text }: { text: string }) {
    return text.split(" · ").map((item, index) => (
        <span className="open-to__item" key={`${item}-${index}`}>
            {index ? <span className="open-to__sep"> · </span> : null}
            {item}
        </span>
    ));
}

/**
 * What the owner is open to (the profile's `availability`, joined by
 * `availabilityLine`): the active status mark and its label over the line,
 * printed as written. The /resume and /contact heads; the home hero sets
 * its own, centred. Render it only when there is a line.
 */
export default function Availability({
    label,
    text,
    className,
}: {
    /** "Open to". */
    label: string;
    /** "Summer 2027 internships · Full-time opportunities in 2028". */
    text: string;
    className?: string;
}) {
    return (
        <div
            className={className ? `availability ${className}` : "availability"}
        >
            <Status value="active">{label}</Status>
            <p className="availability__text open-to">
                <OpenToItems text={text} />
            </p>
        </div>
    );
}
