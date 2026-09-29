import { Status } from "@/components/ui/marks";

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
            <p className="availability__text">{text}</p>
        </div>
    );
}
