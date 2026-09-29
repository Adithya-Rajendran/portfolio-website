import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { ContactRoute } from "@/lib/contact";
import styles from "./contact-routes.module.css";

/**
 * The contact routes (G4) as short hairline rows beside the form: each
 * route's title, the owner's own line where there is one (Research: the
 * invitation) and its links. The form's Topic radios are the one control
 * that picks a topic; a row lights while its topic is chosen. On /contact
 * (`onPage`) each row carries its topic's fragment id (`#hiring`), which
 * ContactDesk turns into "pick this topic" on arrival. Titles and lines
 * are the profile's words (lib/contact.ts); what to write is only ever
 * the form's optional placeholder.
 */
export default function ContactRoutes({
    routes,
    onPage = false,
    titleAs: Title = "h3",
    labelledBy,
}: {
    routes: readonly ContactRoute[];
    onPage?: boolean;
    titleAs?: "h3" | "h4";
    labelledBy?: string;
}) {
    return (
        <ul className={styles.routes} role="list" aria-labelledby={labelledBy}>
            {routes.map((route) => (
                <li
                    key={route.topic}
                    id={onPage ? route.topic : undefined}
                    className={styles.route}
                    data-topic={route.topic}
                >
                    <Title className={styles.title}>{route.title}</Title>
                    {route.body ? (
                        <p className={styles.body}>{route.body}</p>
                    ) : null}
                    {route.links.length ? (
                        <ul className={styles.links} role="list">
                            {route.links.map((link) => (
                                <li key={link.href}>
                                    {link.external ? (
                                        <a
                                            href={link.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            {link.label}
                                            <Icon name="external" />
                                        </a>
                                    ) : (
                                        <Link href={link.href}>
                                            {link.label}
                                        </Link>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </li>
            ))}
        </ul>
    );
}
