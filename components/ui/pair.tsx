/**
 * A themed name with its plain label: "FLIGHT LOG / Blog". The slash is
 * drawn by CSS; assistive technology hears "Flight Log, Blog". Always
 * render both names (plan §4.5).
 */
export default function Pair({
    themed,
    plain,
    className,
}: {
    themed: string;
    plain: React.ReactNode;
    className?: string;
}) {
    return (
        <span className={className ? `pair ${className}` : "pair"}>
            <span className="pair__themed">{themed}</span>
            <span className="pair__plain">
                <span className="sr-only">, </span>
                {plain}
            </span>
        </span>
    );
}
