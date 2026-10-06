/**
 * Comms (G4, plan §2.5.6): contact routes by intent, not by channel. Each
 * route is a topic the form can send, so the message arrives with its
 * subject already sorted; the form's Topic radios are the routes (premium
 * D3). Pure: the page, the form, the server action and the tests share
 * it. The topics and when each route shows are fixed here and in
 * lib/copy.ts; every word about the owner is the profile's, printed as
 * written: each route's title and prompt (`contactRoutes`) and the
 * research invitation (`contactInvitation`). Hiring shows while the
 * profile says what the owner is open to (`availabilityLine`).
 *
 * There is no public email address or phone number: the form is the only
 * channel, with LinkedIn as the alternative when JavaScript is off or a
 * send does not go.
 */
import { contactCopy } from "@/lib/copy";
import { REPORT_PARAM } from "@/lib/navigation";
import { availabilityLine } from "@/lib/profile-content";
import { EMAIL_MAX_LENGTH, MESSAGE_MAX_LENGTH } from "@/lib/contact-constants";
import type { ProfileData } from "@/lib/sanity-client";

/** Every topic the form accepts, in route order. */
export const CONTACT_TOPICS = [
    "hiring",
    "research",
    "consulting",
    "hello",
] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

/** A message sent without choosing a topic. */
export const DEFAULT_CONTACT_TOPIC: ContactTopic = "hello";

export function isContactTopic(value: unknown): value is ContactTopic {
    return (
        typeof value === "string" &&
        (CONTACT_TOPICS as readonly string[]).includes(value)
    );
}

/**
 * The form's state after each send (`sendEmailAction`): sent; a field the
 * server refused (`invalid`, shown under that field); or not sent
 * (`error`, under Send, with the ways on). The fields are controlled and
 * never reset by React, so no state echoes them.
 */
export type ContactFormState =
    | { status: "idle" }
    | { status: "success" }
    | { status: "invalid"; field: keyof ContactFields; message: string }
    | { status: "error"; message: string };

export const INITIAL_CONTACT_FORM_STATE: ContactFormState = { status: "idle" };

/** The email subject: "[Hiring] Contact Form for My Website". */
export function contactSubject(topic: ContactTopic): string {
    return `[${contactCopy.topics[topic].name}] Contact Form for My Website`;
}

export interface ContactRoute {
    topic: ContactTopic;
    /** The profile's title for the route, else the topic's name. */
    title: string;
    /** The owner's own sentence (Research: `contactInvitation`): the
     *  topic's description under its radio. */
    body?: string;
    /** An optional prompt (the profile's): the message field's
     *  placeholder once this topic is chosen. Absent when the profile has
     *  none. */
    prompt?: string;
}

/**
 * The routes to show, from the profile, each titled and prompted in the
 * profile's words (`contactRoutes`; a route without a title takes its
 * topic's name, and one without a prompt has none). What the owner is
 * open to is the page head's (`availabilityLine`), not a route's:
 * - Hiring, while the profile says what the owner is open to (the same
 *   line the head shows; unset or Closed shows none);
 * - Research & collaboration, when the profile has a contact invitation
 *   (the owner's own words are its body);
 * - Consulting, only while `availability.consultingOpen` is on (off by
 *   default: the site must be on Vercel Pro first, plan §8.4);
 * - Hello, always.
 */
export function contactRoutes(profile: ProfileData | null): ContactRoute[] {
    const availability = profile?.availability;
    const invitation = profile?.contactInvitation?.trim();
    const shown: ContactRoute[] = [];
    const route = (topic: ContactTopic) => {
        const words = profile?.contactRoutes?.[topic];
        const prompt = words?.prompt?.trim();
        return {
            topic,
            title: words?.title?.trim() || contactCopy.topics[topic].name,
            ...(prompt ? { prompt } : {}),
        };
    };

    if (availabilityLine(availability)) shown.push(route("hiring"));
    if (invitation) shown.push({ ...route("research"), body: invitation });
    if (availability?.consultingOpen === true) shown.push(route("consulting"));
    shown.push(route("hello"));
    return shown;
}

/** A topic as the form offers it: one radio per route shown. */
export interface TopicOption {
    value: ContactTopic;
    label: string;
    /** The owner's line about the route, under its radio. */
    description?: string;
    /** What to include: the message placeholder for this topic. */
    prompt?: string;
}

export function topicOptions(routes: readonly ContactRoute[]): TopicOption[] {
    return routes.map((route) => ({
        value: route.topic,
        label: route.title,
        ...(route.body ? { description: route.body } : {}),
        ...(route.prompt ? { prompt: route.prompt } : {}),
    }));
}

/**
 * The topic a URL fragment picks ("#hiring"), when that route is shown.
 * The page reads the fragment on the client, never `searchParams`, which
 * would make it request-bound. A malformed escape ("#%") picks nothing:
 * decoding it throws, which would replace the page with the error page.
 */
export function topicFromHash(
    hash: string,
    shown: readonly ContactTopic[],
): ContactTopic | null {
    let value: string;
    try {
        value = decodeURIComponent(hash.replace(/^#/, ""));
    } catch {
        return null;
    }
    return isContactTopic(value) && shown.includes(value) ? value : null;
}

export interface ContactFields {
    senderEmail: string;
    message: string;
}

export type ContactFieldErrors = Partial<Record<keyof ContactFields, string>>;

/**
 * An email address's shape, the same in the form and the server action,
 * so the form flags what the server would refuse: a local part of 64
 * characters at most (RFC 5321) in RFC 5322's dot-atom (letters, digits
 * and !#$%&'*+/=?^_`{|}~-, dots between them: "o'brien@…" passes), then a
 * domain of two or more labels in any script ("bücher.de"), which the
 * server looks up in its ASCII form. The whole address is
 * `EMAIL_MAX_LENGTH` (254) at most.
 */
export const EMAIL_PATTERN =
    /^(?=[^@]{1,64}@)[\w!#$%&'*+/=?^`{|}~-]+(?:\.[\w!#$%&'*+/=?^`{|}~-]+)*@(?:[\p{L}\p{N}](?:[\p{L}\p{M}\p{N}-]*[\p{L}\p{M}\p{N}])?\.)+[\p{L}\p{N}](?:[\p{L}\p{M}\p{N}-]*[\p{L}\p{M}\p{N}])?$/u;

/**
 * The form's own checks before it sends, worded for the field they
 * belong to. The server repeats them, then checks that the domain can
 * receive mail.
 */
export function validateContactFields({
    senderEmail,
    message,
}: ContactFields): ContactFieldErrors {
    const errors: ContactFieldErrors = {};
    const email = senderEmail.trim();
    const { errors: copy } = contactCopy.form;
    if (!email) errors.senderEmail = copy.emailMissing;
    else if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
        errors.senderEmail = copy.emailInvalid;
    }
    if (!message.trim()) errors.message = copy.messageMissing;
    else if (message.length > MESSAGE_MAX_LENGTH) {
        errors.message = copy.messageLong(MESSAGE_MAX_LENGTH);
    }
    return errors;
}

/**
 * When the form shows its checks: none at first; the email's shape once
 * the reader leaves a filled email field (`email`); every rule, an empty
 * field included, from the first submit (`all`).
 */
export type ContactChecks = "none" | "email" | "all";

/** The errors to show beside the fields, for the checks in force. */
export function shownErrors(
    fields: ContactFields,
    checks: ContactChecks,
): ContactFieldErrors {
    if (checks === "none") return {};
    const found = validateContactFields(fields);
    if (checks === "all") return found;
    return fields.senderEmail.trim() && found.senderEmail
        ? { senderEmail: found.senderEmail }
        : {};
}

/**
 * The message a broken link's report starts with (the 404's "Let me
 * know", `reportHref`): the missed address, when the query names a path
 * on this site. Anything else is ignored, so a crafted link cannot write
 * the message. The form reads it on the client, never `searchParams`.
 */
export function reportedMessage(search: string): string | null {
    const path = new URLSearchParams(search).get(REPORT_PARAM);
    if (!path || !/^\/(?!\/)\S{0,300}$/.test(path)) return null;
    return contactCopy.form.brokenLink(path);
}

/**
 * What the message counter announces: nothing until 100 characters are
 * left, then once per band, so a screen reader is not told every keystroke.
 */
export function remainingNotice(length: number): string {
    const left = MESSAGE_MAX_LENGTH - length;
    if (left <= 0) return contactCopy.form.countFull;
    if (left <= 50) return contactCopy.form.countFifty;
    if (left <= 100) return contactCopy.form.countHundred;
    return "";
}
