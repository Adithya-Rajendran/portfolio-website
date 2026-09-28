"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { topicFromHash, type ContactTopic } from "@/lib/contact";
import styles from "./contact-routes.module.css";

interface DeskTopic {
    topic: ContactTopic | null;
    chooseTopic: (topic: ContactTopic) => void;
}

const DeskContext = createContext<DeskTopic | null>(null);

/** The topic the page's routes and form share, when inside a ContactDesk. */
export function useDeskTopic(): DeskTopic | null {
    return useContext(DeskContext);
}

/** Smooth only where spatial motion is allowed (plan §4.4). */
function scrollBehavior(): ScrollBehavior {
    const full =
        document.documentElement.dataset.motion === "full" &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return full ? "smooth" : "auto";
}

/**
 * Keeps /contact's routes and form on one topic. The fragment picks it on
 * arrival and on `hashchange` (`/contact#hiring`), a route's button picks
 * it and scrolls to the form, and a topic picked in the form lights its
 * route and updates the fragment, so the address can be shared. The chosen
 * topic is this element's `data-topic`, which the route styles read.
 * Lookups stay inside this element, never the document: Cache Components
 * keeps other visited pages mounted but hidden.
 */
export default function ContactDesk({
    topics,
    children,
}: {
    /** The topics of the routes shown, in order. */
    topics: readonly ContactTopic[];
    children: React.ReactNode;
}) {
    const [topic, setTopic] = useState<ContactTopic | null>(null);
    const root = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fromHash = () => {
            const picked = topicFromHash(window.location.hash, topics);
            if (picked) setTopic(picked);
        };
        fromHash();
        window.addEventListener("hashchange", fromHash);
        return () => window.removeEventListener("hashchange", fromHash);
    }, [topics]);

    function chooseTopic(next: ContactTopic) {
        setTopic(next);
        // Next.js syncs its router with native history calls (docs:
        // linking-and-navigating, window.history.replaceState).
        window.history.replaceState(null, "", `#${next}`);
    }

    function onClick(event: React.MouseEvent<HTMLDivElement>) {
        if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
        ) {
            return;
        }
        const link = (event.target as Element).closest<HTMLAnchorElement>(
            "a[data-contact-topic]",
        );
        const picked = link
            ? topicFromHash(link.dataset.contactTopic ?? "", topics)
            : null;
        if (!picked) return;
        event.preventDefault();
        chooseTopic(picked);
        const message = root.current?.querySelector<HTMLElement>(
            "[data-contact-message]",
        );
        message?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
        // From the keyboard, carry on into the form; a mouse user clicks
        // the field they want.
        if (event.detail === 0) {
            message
                ?.querySelector<HTMLInputElement>('input[type="email"]')
                ?.focus({ preventScroll: true });
        }
    }

    return (
        <DeskContext value={{ topic, chooseTopic }}>
            {/* Clicks on the routes' buttons bubble here. The buttons are
                real links (Enter activates them too), so the handler only
                improves on them. */}
            <div
                ref={root}
                className={styles.desk}
                data-topic={topic ?? undefined}
                onClick={onClick}
            >
                {children}
            </div>
        </DeskContext>
    );
}
