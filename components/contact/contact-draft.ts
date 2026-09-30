import type { ContactFields } from "@/lib/contact";

/**
 * The contact form's draft: what the reader has written, kept in memory
 * while the page lives and in sessionStorage for the tab's session, so a
 * failed send or a reload loses nothing. The form reads it through
 * useSyncExternalStore: the server has no draft, so the fields hydrate
 * empty and then show it. Without storage (private modes, a full quota)
 * the draft lasts as long as the page.
 */

const KEY = "ar-contact-draft";

/** Two empty fields. */
export const EMPTY_DRAFT: ContactFields = { senderEmail: "", message: "" };

let draft: ContactFields | null = null;
const listeners = new Set<() => void>();

function stored(): ContactFields {
    try {
        const saved: unknown = JSON.parse(
            window.sessionStorage.getItem(KEY) ?? "null",
        );
        if (
            saved &&
            typeof saved === "object" &&
            "senderEmail" in saved &&
            "message" in saved &&
            typeof saved.senderEmail === "string" &&
            typeof saved.message === "string"
        ) {
            return { senderEmail: saved.senderEmail, message: saved.message };
        }
    } catch {
        // No storage, or not a draft: start empty.
    }
    return EMPTY_DRAFT;
}

export function getDraft(): ContactFields {
    draft ??= stored();
    return draft;
}

export function getServerDraft(): ContactFields {
    return EMPTY_DRAFT;
}

export function subscribeDraft(callback: () => void): () => void {
    listeners.add(callback);
    return () => {
        listeners.delete(callback);
    };
}

/** Keeps `next` in memory and in storage (two empty fields are none). */
export function setDraft(next: ContactFields) {
    draft = next;
    try {
        if (next.senderEmail || next.message) {
            window.sessionStorage.setItem(KEY, JSON.stringify(next));
        } else {
            window.sessionStorage.removeItem(KEY);
        }
    } catch {
        // The page keeps it.
    }
    for (const listener of listeners) listener();
}

/** A sent message is no draft: storage forgets it, while the fields keep
 *  their text for "Change". */
export function forgetDraft() {
    try {
        window.sessionStorage.removeItem(KEY);
    } catch {
        // Nothing was kept.
    }
}
