"use client";

import {
    startTransition,
    useActionState,
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import { sendEmailAction } from "@/actions/sendEmail";
import CopyButton from "@/components/blogs/copy-button";
import { Button, buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import Segmented from "@/components/ui/segmented";
import {
    INITIAL_CONTACT_FORM_STATE,
    remainingNotice,
    reportedMessage,
    shownErrors,
    validateContactFields,
    type ContactChecks,
    type ContactFieldErrors,
    type ContactFields,
    type ContactFormState,
    type ContactTopic,
    type TopicOption,
} from "@/lib/contact";
import { EMAIL_MAX_LENGTH, MESSAGE_MAX_LENGTH } from "@/lib/contact-constants";
import { contactCopy } from "@/lib/copy";
import { REPORT_PARAM } from "@/lib/navigation";
import type { ExternalLink } from "@/lib/sanity-client";
import { useDeskTopic } from "./contact-desk";
import {
    EMPTY_DRAFT,
    forgetDraft,
    getDraft,
    getServerDraft,
    setDraft,
    subscribeDraft,
} from "./contact-draft";
import styles from "./contact-form.module.css";

const copy = contactCopy.form;

/**
 * The server action, with the network's failures caught here: a send that
 * never reaches the server (offline, a dropped connection, a new deploy)
 * is the form's own failure, under Send, never the route's error page. A
 * sent message is no longer a draft.
 */
async function send(
    previous: ContactFormState,
    data: FormData,
): Promise<ContactFormState> {
    try {
        const next = await sendEmailAction(previous, data);
        if (next.status === "success") forgetDraft();
        return next;
    } catch {
        return { status: "error", message: copy.failures.unsent };
    }
}

/**
 * The contact form: an optional topic (one per route shown), your email and
 * a message, sent by the server action (BotID, Zod, the WAF rate limit,
 * the MX check, Resend). It needs JavaScript for BotID's challenge, so its
 * wrapper is `.js-only` and the page offers LinkedIn in a <noscript>
 * block instead (plan §2.5.6).
 *
 * - Inside ContactDesk (/contact) the topic is the page's, so routes and
 *   radios stay in step; outside one it is local.
 * - The fields are the draft (contact-draft.ts), kept for the tab's
 *   session and restored on reload; the action is dispatched from
 *   onSubmit, so React never resets them.
 * - The email is checked when the reader leaves it filled, and every rule
 *   (an empty field too) from the first submit. A field the server
 *   refuses is shown under that field.
 * - A send that did not go says so under Send, with the text kept and
 *   the ways on: Try again, Copy message, LinkedIn.
 * - A sent message shows "Message received." and the reply address, with
 *   Change back to the filled form. Cache Components keeps a visited page
 *   mounted but hidden, so that panel and a refused send's alert are reset
 *   when the page is hidden (docs: preserving-ui-state, Forms), while an
 *   unsent draft is kept.
 */
export default function ContactForm({
    topics,
    linkedIn,
}: {
    topics: readonly TopicOption[];
    /** The profile's LinkedIn: a way on when a send fails. */
    linkedIn?: ExternalLink;
}) {
    const id = useId();
    const desk = useDeskTopic();
    const [ownTopic, setOwnTopic] = useState<ContactTopic | null>(null);
    const topic = desk ? desk.topic : ownTopic;
    const chooseTopic = desk ? desk.chooseTopic : setOwnTopic;

    const [state, dispatch, pending] = useActionState(
        send,
        INITIAL_CONTACT_FORM_STATE,
    );
    // A result the reader has moved past (Change, "Write another message",
    // an edit after a refused field, or the page was hidden) is shown as
    // the idle form.
    const [dismissed, setDismissed] = useState<ContactFormState>(
        INITIAL_CONTACT_FORM_STATE,
    );
    const shown = state === dismissed ? INITIAL_CONTACT_FORM_STATE : state;

    const draft = useSyncExternalStore(
        subscribeDraft,
        getDraft,
        getServerDraft,
    );
    const { senderEmail, message } = draft;
    const [checks, setChecks] = useState<ContactChecks>("none");

    const formRef = useRef<HTMLFormElement>(null);
    const emailRef = useRef<HTMLInputElement>(null);
    const messageRef = useRef<HTMLTextAreaElement>(null);
    const failureRef = useRef<HTMLDivElement>(null);
    const latest = useRef(state);
    useEffect(() => {
        latest.current = state;
    });
    // When the page is hidden: a sent message's panel and a refused send's
    // alert are stale on return, so both go; an unsent draft stays.
    useLayoutEffect(
        () => () => {
            const last = latest.current;
            if (last.status === "idle") return;
            setDismissed(last);
            if (last.status === "success") {
                setDraft(EMPTY_DRAFT);
                setChecks("none");
            }
        },
        [],
    );
    // A broken link's report (the 404's "Let me know"): the missed address
    // starts the message unless a draft is waiting, and the query leaves
    // the address bar, so a reload or a shared address does not repeat it.
    useEffect(() => {
        const url = new URL(window.location.href);
        if (!url.searchParams.has(REPORT_PARAM)) return;
        const report = reportedMessage(url.search);
        url.searchParams.delete(REPORT_PARAM);
        // Next.js syncs its router with native history calls.
        window.history.replaceState(null, "", url);
        const current = getDraft();
        if (report && !current.message.trim()) {
            setDraft({ ...current, message: report });
        }
    }, []);
    // What a send leaves to do comes into sight: a field the server
    // refused takes the focus, as the form's own checks do; a send that
    // did not go is brought into view under Send.
    useEffect(() => {
        if (shown.status === "invalid") {
            const field = shown.field === "senderEmail" ? emailRef : messageRef;
            field.current?.focus();
        } else if (shown.status === "error") {
            failureRef.current?.scrollIntoView({ block: "nearest" });
        }
    }, [shown]);

    const ids = {
        email: `${id}-email`,
        emailError: `${id}-email-error`,
        message: `${id}-message`,
        messageHint: `${id}-message-hint`,
        messageError: `${id}-message-error`,
    };
    const prompt = topics.find((option) => option.value === topic)?.prompt;
    const errors: ContactFieldErrors =
        shown.status === "invalid"
            ? { ...shownErrors(draft, checks), [shown.field]: shown.message }
            : shownErrors(draft, checks);

    function edit(next: ContactFields) {
        setDraft(next);
        if (shown.status === "invalid") setDismissed(state);
    }

    function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pending) return;
        setChecks("all");
        const found = validateContactFields(draft);
        if (found.senderEmail || found.message) {
            (found.senderEmail ? emailRef : messageRef).current?.focus();
            return;
        }
        const data = new FormData(event.currentTarget);
        startTransition(() => dispatch(data));
    }

    function change() {
        // Back to the filled form, the address first: a draft again.
        setDismissed(state);
        setDraft(getDraft());
        requestAnimationFrame(() => emailRef.current?.focus());
    }

    function writeAnother() {
        setDismissed(state);
        setDraft(EMPTY_DRAFT);
        setChecks("none");
        requestAnimationFrame(() => emailRef.current?.focus());
    }

    if (shown.status === "success") {
        return (
            <div className={styles.received}>
                <h3
                    className={styles.receivedTitle}
                    tabIndex={-1}
                    ref={(title) => title?.focus()}
                >
                    {copy.successTitle}
                </h3>
                <p className={styles.replies}>
                    {copy.repliesTo} <strong>{senderEmail.trim()}</strong>.{" "}
                    <button
                        type="button"
                        className={styles.change}
                        aria-label={copy.changeLabel}
                        onClick={change}
                    >
                        {copy.change}
                    </button>
                </p>
                <p className={styles.again}>
                    <Button size="sm" onClick={writeAnother}>
                        {copy.again}
                    </Button>
                </p>
            </div>
        );
    }

    const left = MESSAGE_MAX_LENGTH - message.length;
    return (
        <form
            ref={formRef}
            className={styles.form}
            onSubmit={onSubmit}
            noValidate
        >
            {topics.length > 1 ? (
                <Segmented
                    className={styles.topics}
                    legend={
                        <>
                            {copy.topicLegend}{" "}
                            <span className={styles.optional}>
                                {copy.topicOptional}
                            </span>
                        </>
                    }
                    legendClassName="field__label"
                    name="topic"
                    options={topics}
                    value={topic ?? ""}
                    onChange={(value) => chooseTopic(value as ContactTopic)}
                />
            ) : null}

            <div className="field">
                <label className="field__label" htmlFor={ids.email}>
                    {copy.emailLabel}
                </label>
                <input
                    ref={emailRef}
                    className="input"
                    id={ids.email}
                    name="senderEmail"
                    type="email"
                    autoComplete="email"
                    maxLength={EMAIL_MAX_LENGTH}
                    placeholder={copy.emailPlaceholder}
                    required
                    value={senderEmail}
                    onChange={(event) =>
                        edit({ ...getDraft(), senderEmail: event.target.value })
                    }
                    onBlur={() => {
                        if (checks === "none" && senderEmail.trim()) {
                            setChecks("email");
                        }
                    }}
                    aria-invalid={errors.senderEmail ? true : undefined}
                    aria-describedby={
                        errors.senderEmail ? ids.emailError : undefined
                    }
                />
                {errors.senderEmail ? (
                    <p className="field__error" id={ids.emailError}>
                        <Icon name="close" className="icon--sm" />{" "}
                        {errors.senderEmail}
                    </p>
                ) : null}
            </div>

            <div className="field">
                <div className={styles.fieldRow}>
                    <label className="field__label" htmlFor={ids.message}>
                        {copy.messageLabel}
                    </label>
                    {left <= 100 ? (
                        <span className={styles.count} aria-hidden="true">
                            {message.length} / {MESSAGE_MAX_LENGTH}
                        </span>
                    ) : null}
                </div>
                <textarea
                    ref={messageRef}
                    className="textarea"
                    id={ids.message}
                    name="message"
                    rows={5}
                    maxLength={MESSAGE_MAX_LENGTH}
                    placeholder={prompt ?? copy.messagePlaceholder}
                    required
                    value={message}
                    onChange={(event) =>
                        edit({ ...getDraft(), message: event.target.value })
                    }
                    aria-invalid={errors.message ? true : undefined}
                    aria-describedby={
                        errors.message
                            ? `${ids.messageHint} ${ids.messageError}`
                            : ids.messageHint
                    }
                />
                {/* The limit is the field's description for assistive
                    tech; the counter above shows only near it. */}
                <p className="sr-only" id={ids.messageHint}>
                    {copy.messageHint(MESSAGE_MAX_LENGTH)}
                </p>
                {errors.message ? (
                    <p className="field__error" id={ids.messageError}>
                        <Icon name="close" className="icon--sm" />{" "}
                        {errors.message}
                    </p>
                ) : null}
                <p className="sr-only" aria-live="polite">
                    {remainingNotice(message.length)}
                </p>
            </div>

            <div className={styles.actions}>
                <Button
                    type="submit"
                    variant="primary"
                    icon="arrow"
                    iconAt="end"
                    aria-disabled={pending || undefined}
                    aria-busy={pending || undefined}
                >
                    {pending ? copy.sending : copy.send}
                </Button>
            </div>

            {shown.status === "error" ? (
                <div ref={failureRef} className={styles.failure}>
                    <p className={styles.failureText} role="alert">
                        <Icon
                            name="close"
                            className={`icon--sm ${styles.failureIcon}`}
                        />{" "}
                        {shown.message} {copy.kept}
                    </p>
                    <div className={`cluster ${styles.recover}`}>
                        <Button
                            size="sm"
                            variant="quiet"
                            icon="reset"
                            onClick={() => formRef.current?.requestSubmit()}
                        >
                            {copy.retry}
                        </Button>
                        <CopyButton
                            text={message}
                            idle={copy.copyMessage}
                            done={copy.copied}
                            failed={copy.copyFailed}
                            announceDone={copy.announceCopied}
                            announceFailed={copy.announceCopyFailed}
                        />
                        {linkedIn ? (
                            <a
                                className={buttonClass({
                                    size: "sm",
                                    variant: "quiet",
                                })}
                                href={linkedIn.url}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {contactCopy.linkedIn}
                                <Icon name="external" />
                            </a>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </form>
    );
}
