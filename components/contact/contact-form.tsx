"use client";

import {
    startTransition,
    useActionState,
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { sendEmailAction } from "@/actions/sendEmail";
import { Button } from "@/components/ui/button";
import Segmented from "@/components/ui/segmented";
import {
    INITIAL_CONTACT_FORM_STATE,
    remainingNotice,
    validateContactFields,
    type ContactFieldErrors,
    type ContactFormState,
    type ContactTopic,
    type TopicOption,
} from "@/lib/contact";
import { EMAIL_MAX_LENGTH, MESSAGE_MAX_LENGTH } from "@/lib/contact-constants";
import { contactCopy } from "@/lib/copy";
import { useDeskTopic } from "./contact-desk";
import styles from "./contact-form.module.css";

const copy = contactCopy.form;

interface Sent {
    from: string;
    length: number;
}

/**
 * The contact form: an optional topic (one per route shown), your email and
 * a message, sent by the unchanged server action (BotID, Zod, the WAF rate
 * limit, the MX check, Resend). It needs JavaScript for BotID's challenge,
 * so its wrapper is `.js-only` and the page offers LinkedIn in a
 * <noscript> block instead (plan §2.5.6).
 *
 * - Inside ContactDesk (/contact) the topic is the page's, so routes and
 *   radios stay in step; outside one it is local.
 * - The fields are controlled and the action is dispatched from onSubmit,
 *   so React never resets them: a refused send keeps what was written.
 * - A successful send shows "Sent". Cache Components keeps a
 *   visited page mounted but hidden, so that panel and a refused send's
 *   alert are reset when the page is hidden (docs: preserving-ui-state,
 *   Forms), while an unsent draft is kept.
 */
export default function ContactForm({
    topics,
}: {
    topics: readonly TopicOption[];
}) {
    const id = useId();
    const desk = useDeskTopic();
    const [ownTopic, setOwnTopic] = useState<ContactTopic | null>(null);
    const topic = desk ? desk.topic : ownTopic;
    const chooseTopic = desk ? desk.chooseTopic : setOwnTopic;

    const [state, dispatch, pending] = useActionState(
        sendEmailAction,
        INITIAL_CONTACT_FORM_STATE,
    );
    // A result the reader has moved past ("Write another message", or the
    // page was hidden) is shown as the idle form.
    const [dismissed, setDismissed] = useState<ContactFormState>(
        INITIAL_CONTACT_FORM_STATE,
    );
    const shown = state === dismissed ? INITIAL_CONTACT_FORM_STATE : state;

    const [senderEmail, setSenderEmail] = useState("");
    const [message, setMessage] = useState("");
    const [errors, setErrors] = useState<ContactFieldErrors>({});
    const [checked, setChecked] = useState(false);
    const [sent, setSent] = useState<Sent | null>(null);

    const emailRef = useRef<HTMLInputElement>(null);
    const messageRef = useRef<HTMLTextAreaElement>(null);
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
                setSenderEmail("");
                setMessage("");
                setErrors({});
                setChecked(false);
            }
        },
        [],
    );

    const ids = {
        email: `${id}-email`,
        emailError: `${id}-email-error`,
        message: `${id}-message`,
        messageHint: `${id}-message-hint`,
        messageError: `${id}-message-error`,
    };
    const prompt = topics.find((option) => option.value === topic)?.prompt;

    function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pending) return;
        const found = validateContactFields({ senderEmail, message });
        setChecked(true);
        setErrors(found);
        if (found.senderEmail || found.message) {
            (found.senderEmail ? emailRef : messageRef).current?.focus();
            return;
        }
        const data = new FormData(event.currentTarget);
        setSent({ from: senderEmail.trim(), length: message.length });
        startTransition(() => dispatch(data));
    }

    function onEmail(value: string) {
        setSenderEmail(value);
        if (checked)
            setErrors(validateContactFields({ senderEmail: value, message }));
    }

    function onMessage(value: string) {
        setMessage(value);
        if (checked)
            setErrors(validateContactFields({ senderEmail, message: value }));
    }

    function writeAnother() {
        setDismissed(state);
        setSenderEmail("");
        setMessage("");
        setErrors({});
        setChecked(false);
        requestAnimationFrame(() => emailRef.current?.focus());
    }

    if (shown.status === "success") {
        const route = topics.find((option) => option.value === shown.topic);
        return (
            <div className={styles.signal}>
                <svg
                    className={styles.trace}
                    viewBox="0 0 600 64"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path className={styles.floor} d="M0 32H600" />
                    <path
                        className={styles.wave}
                        pathLength={1}
                        d="M0 32H150C158 32 162 18 170 18S182 46 190 46 202 12 210 12 222 52 230 52 242 10 250 10 262 54 270 54 282 10 290 10 302 54 310 54 322 10 330 10 342 54 350 54 362 10 370 10 382 54 390 54 402 10 410 10 422 54 430 54 442 10 450 10 462 54 470 54 482 10 490 10 502 54 510 54 522 10 530 10 542 54 550 54 562 10 570 10 582 54 590 54 600 32 600 32"
                    />
                    <circle className={styles.acq} cx="150" cy="32" r="4.5" />
                </svg>
                <p className={styles.signalKey}>
                    <span className={styles.dot} aria-hidden="true" />
                    {copy.successTag}
                </p>
                <h3
                    className={styles.signalTitle}
                    tabIndex={-1}
                    ref={(title) => title?.focus()}
                >
                    {copy.successTitle}
                </h3>
                <dl className={styles.log}>
                    <div>
                        <dt>{copy.logTopic}</dt>
                        <dd>
                            {route?.label ??
                                contactCopy.topics[shown.topic].name}
                        </dd>
                    </div>
                    {sent ? (
                        <>
                            <div>
                                <dt>{copy.logFrom}</dt>
                                <dd>{sent.from}</dd>
                            </div>
                            <div>
                                <dt>{copy.logLength}</dt>
                                <dd>
                                    {copy.logLengthValue(
                                        sent.length,
                                        MESSAGE_MAX_LENGTH,
                                    )}
                                </dd>
                            </div>
                        </>
                    ) : null}
                </dl>
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
        <form className={styles.form} onSubmit={onSubmit} noValidate>
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
                    onChange={(event) => onEmail(event.target.value)}
                    aria-invalid={errors.senderEmail ? true : undefined}
                    aria-describedby={
                        errors.senderEmail ? ids.emailError : undefined
                    }
                />
                {errors.senderEmail ? (
                    <p className="field__error" id={ids.emailError}>
                        {errors.senderEmail}
                    </p>
                ) : null}
            </div>

            <div className="field">
                <div className={styles.fieldRow}>
                    <label className="field__label" htmlFor={ids.message}>
                        {copy.messageLabel}
                    </label>
                    <span
                        className={styles.count}
                        aria-hidden="true"
                        data-near={left <= 100 ? "" : undefined}
                    >
                        {message.length} / {MESSAGE_MAX_LENGTH}
                    </span>
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
                    onChange={(event) => onMessage(event.target.value)}
                    aria-invalid={errors.message ? true : undefined}
                    aria-describedby={
                        errors.message
                            ? `${ids.messageHint} ${ids.messageError}`
                            : ids.messageHint
                    }
                />
                <p className="field__hint" id={ids.messageHint}>
                    {copy.messageHint(MESSAGE_MAX_LENGTH)}
                </p>
                {errors.message ? (
                    <p className="field__error" id={ids.messageError}>
                        {errors.message}
                    </p>
                ) : null}
                <p className="sr-only" aria-live="polite">
                    {remainingNotice(message.length)}
                </p>
            </div>

            {shown.status === "error" ? (
                <p className={styles.alert} role="alert">
                    {shown.message}
                </p>
            ) : null}

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
        </form>
    );
}
