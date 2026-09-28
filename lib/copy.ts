/**
 * Interface microcopy: the documentation wit of the Flight Manual grafts
 * (G7) and the chrome's fixed labels. UI copy only: nothing here states a
 * fact about the owner, which always comes from the Sanity profile.
 */

export const chromeCopy = {
    skipLink: "Skip to content",
    homeLabel: "Adithya Rajendran, home",
    menu: "Menu",
    close: "Close",
    themeLegend: "Theme",
    holdDrift: "Hold drift",
    resumeDrift: "Resume drift",
    motionHeldByOs: "Motion held · system setting",
    footerSign: "Built on Earth. Still in flight.",
    backToTop: "Back to top",
    revTitle: "Last revised",
} as const;

/** The theme toggle's options, themed name over plain name. */
export const themeOptions = [
    { value: "void", themed: "Void", plain: "Dark" },
    { value: "manual", themed: "Manual", long: "Flight ", plain: "Light" },
    { value: "auto", themed: "Auto", plain: "System" },
] as const;

/** Loss of Signal: the 404 (G7). */
export const lossOfSignalCopy = {
    tag: "LOS · 404",
    themed: "Loss of Signal",
    plain: "Page not found",
    title: "Loss of signal",
    lead: "Nothing is transmitting from this address. The page may have moved, been renamed, or never existed.",
    requested: "Requested",
    traceCaption: "Carrier · last 60 s",
    traceMid: "Signal strength, relative",
    traceEnd: "AOS · pending",
    traceLos: "LOS",
    traceFlat: "No carrier",
    returnTag: "AOS",
    returnThemed: "Return trajectory",
    returnPlain: "Site sections",
    report: "Followed a broken link on this site?",
    reportLink: "Send a message",
    reportTail: "with the address.",
} as const;

/** The error page: the same instrument, a different fault. */
export const errorCopy = {
    tag: "ERR · 500",
    themed: "Telemetry fault",
    plain: "Page error",
    title: "Telemetry fault",
    lead: "This page failed to load. Nothing you did caused it; try again in a moment.",
    retry: "Try again",
} as const;

/**
 * Comms (G4): the contact page, its routes and the form. The heading, the
 * intro, the field labels and the success line are the live form's own
 * words. Route titles, buttons and "Include" templates are UI copy; the
 * facts on the page (availability, the invitation) come from the profile.
 */
export const contactCopy = {
    num: "05",
    themed: "Comms",
    plain: "Contact",
    title: "Let’s talk.",
    intro: "An idea, a question, or an opportunity. I’d like to hear from you.",
    /** The page-head meta: "3 routes · one form · no public email". */
    meta: (routes: number) =>
        `${routes} ${routes === 1 ? "route" : "routes"} · one form · no public email`,
    aosKey: "AOS",
    aosCaption: "Acquisition of signal · carrier locked",
    routesTitle: "Routes",
    routesMeta: "Pick the one that fits · it sets the topic below",
    messageTitle: "Message",
    elsewhereThemed: "Elsewhere",
    elsewherePlain: "Profiles",
    elsewhereLede: "Or find me elsewhere.",
    rss: "RSS feed",
    openTo: "Open to",
    include: "Include",
    links: {
        resumePdf: "Résumé (PDF)",
        cv: "Experience and CV",
        rss: "RSS",
    },
    topics: {
        hiring: {
            title: "Internships & roles",
            subject: "Hiring",
            cta: "Write about a role",
            template:
                "The role and the team, where it is based, the dates, and a link to the posting.",
        },
        research: {
            title: "Research & collaboration",
            subject: "Research",
            cta: "Start a conversation",
            template:
                "The problem, what has been tried so far, and where you think I could help.",
        },
        consulting: {
            title: "Consulting",
            subject: "Consulting",
            cta: "Describe the project",
            template:
                "What needs to be designed, built or reviewed, and by when.",
        },
        hello: {
            title: "Hello",
            subject: "Hello",
            cta: "Say hello",
            template:
                "Anything at all. If it is about an entry in the Flight Log, say which one.",
        },
    },
    record: {
        channel: "Channel",
        channelValue: "This form",
        channelNote: (max: number) =>
            `Your email and a message of up to ${max.toLocaleString("en-US")} characters`,
        email: "Email",
        emailNote: "Not published",
        openTo: "Open to",
        updated: "Updated",
        blank: "Intentionally left blank",
    },
    form: {
        topicLegend: "Topic",
        topicOptional: "(optional)",
        emailLabel: "Your email",
        emailPlaceholder: "you@example.com",
        messageLabel: "Message",
        messagePlaceholder: "What’s on your mind?",
        messageHint: (max: number) =>
            `Up to ${max.toLocaleString("en-US")} characters.`,
        countHundred: "100 characters or fewer left.",
        countFifty: "50 characters or fewer left.",
        countFull: "Character limit reached.",
        send: "Send message",
        sending: "Sending…",
        note: "Delivered with Resend after an invisible bot check.",
        errors: {
            emailMissing: "Enter your email address, so I can reply.",
            emailInvalid: "Enter an email address like you@example.com.",
            messageMissing: "Write a message before sending.",
            messageLong: (max: number) =>
                `Shorten the message to ${max.toLocaleString("en-US")} characters or fewer.`,
        },
        successTag: "Signal acquired",
        successTitle: "Message sent. Thanks for getting in touch.",
        logTopic: "Topic",
        logFrom: "From",
        logLength: "Length",
        logLengthValue: (length: number, max: number) =>
            `${length.toLocaleString("en-US")} / ${max.toLocaleString("en-US")} characters`,
        again: "Write another message",
    },
    noScript: {
        title: "The form needs JavaScript.",
        body: "It runs an invisible bot check before anything is sent.",
        linkedIn: "Message me on LinkedIn",
        profiles: "Write to me through one of the profiles below instead.",
    },
    /** The /portfolio#contact section's pointer to the routes. */
    portfolioRoutes: "Or pick a route:",
} as const;
