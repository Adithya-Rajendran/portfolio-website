"use client";

import { useSyncExternalStore } from "react";
import type { ContactTopic } from "@/lib/contact";

const noSubscribe = () => () => {};

/**
 * A route's button on /contact. The server renders it as a link to the
 * message section, which is where a reader without JavaScript should land
 * (the form needs JavaScript, and that section offers LinkedIn instead).
 * Once hydrated it links to the route's own fragment (`#hiring`), so
 * opening it in a new tab or copying it keeps the topic, which ContactDesk
 * picks on arrival; ContactDesk also handles the plain click.
 */
export default function RouteWriteLink({
    topic,
    className,
    children,
}: {
    topic: ContactTopic;
    className?: string;
    children: React.ReactNode;
}) {
    const hydrated = useSyncExternalStore(
        noSubscribe,
        () => true,
        () => false,
    );
    return (
        <a
            className={className}
            href={hydrated ? `#${topic}` : "#message"}
            data-contact-topic={topic}
        >
            {children}
        </a>
    );
}
