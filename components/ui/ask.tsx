/**
 * A page's close (contract §1): one question as the h2, at a section
 * head's size, and the way to act on it (Send a message), in one row
 * between a meaningful rule above and a quiet one below. The mission
 * files ("Questions about this project?") and About use it; the action is
 * a default button, never a second primary.
 */
export default function Ask({
    id,
    title,
    className,
    children,
}: {
    /** The h2's id, for the close's `aria-labelledby`. */
    id: string;
    title: string;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div className={className ? `ask ${className}` : "ask"}>
            <h2 className="ask__title" id={id}>
                {title}
            </h2>
            {children}
        </div>
    );
}
