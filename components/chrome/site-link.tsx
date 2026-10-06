import Link from "next/link";
import type { ComponentProps } from "react";

/**
 * A link to one of the site's pages: next/link, or with `plain` a plain
 * <a href> that loads the page in full. The global 404
 * (app/global-not-found.tsx) passes `plain`: Next.js serves it as its own
 * document, outside the root layout, and its router cannot render a
 * (site) route's payload, so a client navigation from it changed the
 * address and left the 404 on screen. Directive-free, so the server
 * header and the client islands can both render it.
 */
export default function SiteLink({
    plain = false,
    ...props
}: Omit<ComponentProps<"a">, "href"> & { href: string; plain?: boolean }) {
    return plain ? <a {...props} /> : <Link {...props} />;
}
