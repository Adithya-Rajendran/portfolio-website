export default function CareerSectionHeading({
    number,
    title,
    description,
}: {
    number?: string;
    title: string;
    description?: string;
}) {
    return (
        <header className="career-section-heading">
            {number && <p className="journal-eyebrow">{number} / THE RECORD</p>}
            <h2>{title}</h2>
            {description && <p>{description}</p>}
        </header>
    );
}
