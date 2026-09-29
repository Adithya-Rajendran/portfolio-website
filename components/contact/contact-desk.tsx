"use client";

import { createContext, useContext, useEffect, useState } from "react";
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

/**
 * Keeps /contact's routes and form on one topic. The fragment picks it on
 * arrival and on `hashchange` (`/contact#hiring`, the home page's and the
 * CV's links), and a topic picked in the form lights its route and
 * updates the fragment, so the address can be shared. The chosen topic is
 * this element's `data-topic`, which the route styles read.
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

    return (
        <DeskContext value={{ topic, chooseTopic }}>
            <div className={styles.desk} data-topic={topic ?? undefined}>
                {children}
            </div>
        </DeskContext>
    );
}
