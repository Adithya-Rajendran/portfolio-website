import Link from "next/link";
import { primaryNavigation } from "@/lib/navigation";

/** True when `pathname` is `href` or one of its descendants. */
export function isCurrentSection(pathname: string, href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The primary navigation links. With no `pathname` (the server fallback) no
 * link is marked current; ActiveNavLinks passes the client pathname.
 * Directive-free on purpose, so both the server header and the client
 * island can render it.
 */
export default function NavLinks({ pathname }: { pathname?: string }) {
    return (
        <>
            {primaryNavigation.map(({ href, label }) => (
                <Link
                    key={href}
                    href={href}
                    aria-current={
                        pathname && isCurrentSection(pathname, href)
                            ? "page"
                            : undefined
                    }
                >
                    {label}
                </Link>
            ))}
        </>
    );
}
