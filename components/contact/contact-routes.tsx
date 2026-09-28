import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { buttonClass } from "@/components/ui/button";
import type { ContactRoute } from "@/lib/contact";
import { contactCopy as copy } from "@/lib/copy";
import { contactHref } from "@/lib/navigation";
import styles from "./contact-routes.module.css";

/**
 * The contact routes (G4) as numbered rows. On /contact (`onPage`) each
 * row carries its topic's fragment id (`#hiring`), and its button is a
 * link to the message section that ContactDesk turns into "pick this topic
 * and go to the form"; without JavaScript it still lands on the message
 * section, which then offers LinkedIn. Anywhere else the button links to
 * the route on /contact. Ported from the mockup's `DF.render.routes`.
 */
export default function ContactRoutes({
    routes,
    onPage = false,
}: {
    routes: readonly ContactRoute[];
    onPage?: boolean;
}) {
    return (
        <ol className={styles.routes} role="list">
            {routes.map((route) => (
                <li
                    key={route.topic}
                    id={onPage ? route.topic : undefined}
                    className={styles.route}
                    data-topic={route.topic}
                >
                    <span className={styles.num} aria-hidden="true">
                        {route.num}
                    </span>
                    <h3 className={styles.title}>{route.title}</h3>
                    {route.openTo ? (
                        <p className={styles.lede}>
                            <span className={styles.key}>{copy.openTo}</span>
                            {route.openTo}
                        </p>
                    ) : null}
                    {route.body ? (
                        <p className={styles.body}>{route.body}</p>
                    ) : null}
                    <p className={styles.template}>
                        <span className={styles.key}>{copy.include}</span>
                        {route.template}
                    </p>
                    <div className={styles.actions}>
                        {onPage ? (
                            <a
                                className={buttonClass({
                                    className: styles.write,
                                })}
                                href="#message"
                                data-contact-topic={route.topic}
                            >
                                {route.cta}
                                <Icon name="arrow" className="icon--nudge" />
                            </a>
                        ) : (
                            <Link
                                className={buttonClass({
                                    className: styles.write,
                                })}
                                href={contactHref(route.topic)}
                            >
                                {route.cta}
                                <Icon name="arrow" className="icon--nudge" />
                            </Link>
                        )}
                    </div>
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
        </ol>
    );
}
