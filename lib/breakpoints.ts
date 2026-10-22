/**
 * Every width and height a media query names, in rem, so all of them
 * follow the visitor's text size together. CSS writes a min-width at a
 * value and a max-width 0.01rem under it (`(min-width: 60rem)`,
 * `(max-width: 59.99rem)`), and tests/lib/design-system.test.ts checks
 * every `@media` in the stylesheets against this module. TypeScript
 * builds its queries (`matchMedia`, an image's `sizes`) with `minWidth`
 * and `maxWidth`, and reads a width in pixels as `BREAKPOINTS[b] * rem`.
 *
 * `sm`, `md` and `lg` are the grid's (styles/tokens.css), and Tailwind's
 * (app/globals.css); the rest are the widths one part of the page needs:
 * inline code's narrow phones (`floor`, `code`), the header bar's
 * narrowest (`compact`), the hero name's (`name`) and photograph's
 * (`tablet`), and the header's full nav (`header`). `HEIGHTS.short` is
 * the flight's short laptop window.
 */
export const BREAKPOINTS = {
    floor: 20,
    compact: 22.5,
    code: 23,
    name: 24,
    sm: 37.5,
    tablet: 48,
    md: 60,
    header: 75,
    lg: 80,
} as const;

/** @internal Exported for tests. */
export const HEIGHTS = { short: 51.25 } as const;

type Breakpoint = keyof typeof BREAKPOINTS;

/** The media condition from a breakpoint up: `(min-width: 60rem)`. */
export function minWidth(b: Breakpoint): string {
    return `(min-width: ${BREAKPOINTS[b]}rem)`;
}

/** The media condition below a breakpoint, 0.01rem under it, as the
 *  stylesheets write it: `(max-width: 59.99rem)`. */
export function maxWidth(b: Breakpoint): string {
    const v = BREAKPOINTS[b];
    return `(max-width: ${Math.round((v - 0.01) * 100) / 100}rem)`;
}
