/**
 * Icons and the patch, drawn from the inline sprite
 * (components/chrome/svg-sprite.tsx). Decorative: the control or link that
 * holds one carries the name. Directive-free, so server and client
 * components can both render them.
 */

export type IconName =
    | "arrow"
    | "arrow-down"
    | "arrow-up"
    | "external"
    | "search"
    | "close"
    | "menu"
    | "check"
    | "copy"
    | "rss"
    | "download"
    | "reset"
    | "pause"
    | "play"
    | "print"
    | "share"
    | "theme";

export function Icon({
    name,
    className,
}: {
    name: IconName;
    className?: string;
}) {
    return (
        <svg
            className={className ? `icon ${className}` : "icon"}
            aria-hidden="true"
            focusable="false"
        >
            <use href={`#i-${name}`} />
        </svg>
    );
}

/**
 * The AR mission patch. `mark` drops the lettered band (32–63 px). Its
 * orange sun is an identity mark (`data-identity`), outside the accent's
 * budget of two "now" marks a viewport.
 */
export function Patch({
    className,
    mark = false,
}: {
    className?: string;
    mark?: boolean;
}) {
    const classes = ["patch", mark && "patch--mark", className]
        .filter(Boolean)
        .join(" ");
    return (
        <svg
            className={classes}
            viewBox="0 0 200 200"
            aria-hidden="true"
            focusable="false"
            data-identity
        >
            <use href="#ar-patch" />
        </svg>
    );
}
