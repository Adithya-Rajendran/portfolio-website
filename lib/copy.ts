/**
 * Interface microcopy: the chrome's fixed labels, section names, button
 * verbs and form mechanics. UI copy only: nothing here states a fact
 * about the owner, which always comes from the Sanity profile. Every
 * name a reader has to understand is plain (Projects, Writing,
 * Experience, About, Contact); a section's themed name (`themed`) is only
 * the small tag above its page's title.
 */

export const chromeCopy = {
    skipLink: "Skip to content",
    homeLabel: "Adithya Rajendran, home",
    menu: "Menu",
    close: "Close",
    themeLegend: "Theme",
    /** The header's theme switch names the theme it switches to. */
    toLight: "Switch to light theme",
    toDark: "Switch to dark theme",
    holdDrift: "Pause motion",
    resumeDrift: "Resume motion",
    /** The colophon: how the site is made, and its source. */
    colophon: "Built with Next.js, Sanity and three.js",
    source: "Source",
} as const;

/** The theme choices in the footer and the menu sheet: Void, Flight
 *  Manual and the screen's own setting, by their plain names. */
export const themeOptions = [
    { value: "void", label: "Dark" },
    { value: "manual", label: "Light" },
    { value: "auto", label: "System" },
] as const;

/** Loss of Signal: the 404 (G7). */
export const lossOfSignalCopy = {
    tag: "Loss of signal · 404",
    title: "Page not found",
    lead: "It may have moved or no longer exists.",
    home: "Home",
    /** The primary for a missed address under a section's index. */
    index: { missions: "All projects", log: "All writing" },
    report: "Found a broken link?",
    reportLink: "Let me know",
} as const;

/** The error page: the same instrument, a different fault. */
export const errorCopy = {
    tag: "Error · 500",
    title: "Page error",
    lead: "This page failed to load. Please try again.",
    retry: "Try again",
} as const;

/**
 * Contact (themed Comms, G4): the contact page, its routes and the form.
 * UI copy only: the page's introduction, each route's title and prompt,
 * what the owner is open to, the button that answers it and the research
 * invitation are the profile's (Site copy and Status). A topic's `name`
 * is the email subject's prefix and the route's title when the profile
 * gives none.
 */
export const contactCopy = {
    themed: "Comms",
    plain: "Contact",
    /** The form's section, named for screen readers. */
    message: "Message",
    openTo: "Open to",
    topics: {
        hiring: { name: "Hiring" },
        research: { name: "Research" },
        consulting: { name: "Consulting" },
        hello: { name: "Hello" },
    },
    form: {
        topicLegend: "Topic",
        topicOptional: "(optional)",
        emailLabel: "Your email",
        messageLabel: "Message",
        messageHint: (max: number) =>
            `Up to ${max.toLocaleString("en-US")} characters.`,
        countHundred: "100 characters or fewer left.",
        countFifty: "50 characters or fewer left.",
        countFull: "Character limit reached.",
        send: "Send message",
        sending: "Sending…",
        /** Under their field, from the form or the server; the topic's,
         *  which only a crafted POST can trip, under Send. */
        errors: {
            emailMissing: "Enter your email address.",
            emailInvalid: "Enter an email address like you@example.com.",
            emailDomain:
                "The domain after the @ does not receive email. Check the address.",
            messageMissing: "Write a message before sending.",
            messageLong: (max: number) =>
                `Shorten the message to ${max.toLocaleString("en-US")} characters or fewer.`,
            topic: "Choose one of the listed topics.",
        },
        /** A send that did not go, under Send. */
        failures: {
            unsent: "The message could not be sent.",
            unverified:
                "The message could not be verified. Reload the page, then try again.",
            tooMany:
                "Too many messages were sent in a short time. Try again in a few minutes.",
        },
        copyMessage: "Copy message",
        copied: "Copied",
        copyFailed: "Copy failed",
        announceCopied: "Message copied",
        announceCopyFailed: "Copying failed",
        /** The message a report from the 404's "Let me know" starts with. */
        brokenLink: (path: string) => `Broken link: ${path}`,
        /** A sent message promises nothing: no reply address, no time. */
        successTitle: "Message received.",
        again: "Write another message",
    },
    /** The alternative to the form: beside a failed send, and without
     *  JavaScript. */
    linkedIn: "Message me on LinkedIn",
    noScript: "This form requires JavaScript.",
} as const;

/**
 * Writing (the Flight Log, G8): the index and the tag pages. The intro is
 * the owner's own writing description from the profile; everything here
 * is UI copy.
 */
export const logCopy = {
    themed: "Flight Log",
    plain: "Writing",
    rss: "RSS",
    /** "Follow: RSS · LinkedIn", in /blog's head and after an entry. */
    follow: "Follow:",
    /** "5 min read", the words after the number for assistive tech. */
    read: (minutes: number) => `${minutes} min`,
    readSuffix: " read",
    tagList: "Tags",
    empty: "No entries yet.",
    tag: {
        /** The metadata description: "Articles tagged GPU computing." */
        description: (label: string) => `Articles tagged ${label}.`,
    },
} as const;

/**
 * An entry (G1, the paper-grade post). UI copy only: the title,
 * standfirst, text, captions, notes and changelog are the owner's.
 */
export const postCopy = {
    themed: "Flight Log",
    plain: "Writing",
    /** "7 min read". */
    read: (minutes: number) => `${minutes} min read`,
    updated: "Updated",
    contents: "Contents",
    /** The contents' landmark name (plan §4.5). */
    contentsLabel: "On this page",
    listing: {
        copy: "Copy",
        copyLabel: (number: number) => `Copy listing ${number}`,
        copied: "Copied",
        failed: "Copy failed",
        announceCopied: (number: number) => `Listing ${number} copied`,
        announceFailed: "Copying failed",
    },
    notes: {
        title: "Notes",
        ref: (number: number) => `Note ${number}`,
        back: (number: number) => `Back to note ${number} in the text`,
    },
    /** Each dated "30 Jun 2026 · Correction". */
    revisions: "Revisions",
    end: "End of entry",
    after: "After this entry",
    projects: (count: number) =>
        count === 1 ? "Related project" : "Related projects",
    /** The pager's landmark name (it has no visible heading). */
    pager: "Previous and next",
    related: "Related entries",
    /** The print masthead's kicker is the section's plain name. */
    printFiled: "Filed",
} as const;

/**
 * Experience & CV (themed Trajectory; G3): /resume and its print. UI copy
 * only: roles, dates and the summary are the owner's.
 */
export const cvCopy = {
    themed: "Trajectory",
    /** The page's name in titles and share cards. */
    plain: "Experience & CV",
    /** The h1, as the nav names it: the actions under it say CV. */
    title: "Experience",
    /** The share card and metadata when the profile has no summary. */
    description: "Experience, education and skills.",
    /** Where the head's tools sit: the flight (the default where motion
     *  runs) or the list, by plain names. */
    views: {
        legend: "View",
        options: [
            { value: "timeline", label: "Timeline" },
            { value: "list", label: "List" },
        ],
    },
    download: "Download CV (PDF)",
    openTo: "Open to",
    /** The sections' plain names, on screen and on paper. */
    education: "Education",
    experience: "Experience",
    projects: "Projects",
    writing: {
        title: "Writing",
        withTalks: "Writing & talks",
        talks: "Talks",
    },
    allWriting: "All writing",
    skills: "Skills",
    certifications: "Certifications",
    /** Expired credentials, as the résumé names them. */
    priorCertifications: "Prior certifications",
    /** The printed document's control line (G3): its title, then the
     *  revision and the sheet. */
    documentTitle: "Curriculum vitae",
    sheet: (sheet: number, of: number) => `Sheet ${sheet} of ${of}`,
} as const;

/**
 * Projects (themed Missions; G5): the /portfolio index and the project
 * pages (the file and the short note). UI copy only: the page's
 * introduction (`projectsIntro`), names, titles, summaries, highlights,
 * parameters, briefs, results and lessons are the owner's.
 */
export const missionsCopy = {
    themed: "Missions",
    plain: "Projects",
    /** The flagship's section, named for screen readers. */
    flagship: "Featured project",
    more: "More projects",
    readWriteUp: "Read the write-up",
    stack: "Stack",
    /** A project page's share-card alt. */
    file: "Project",
    /** The facts under a project's head: the links other than the
     *  repositories (two in all, or a note's) are Links. */
    facts: {
        status: "Status",
        stack: "Stack",
        role: "Role",
        links: "Links",
    },
    callouts: "Parts of the build",
    /** The brief's title: its rows name problem, approach and outcome. */
    overview: "Overview",
    brief: {
        problem: "Problem",
        approach: "Approach",
        outcome: "Outcome",
    },
    writeUp: "Case study",
    contents: "Contents",
    contentsLabel: "On this page",
    results: "Results",
    /** The results' column heads, for screen readers. */
    resultColumns: { metric: "Metric", value: "Value", note: "Note" },
    /** Lessons and next steps both, each under its subhead; one alone is
     *  titled by its own name. */
    retrospective: "Retrospective",
    lessons: "Lessons",
    nextSteps: "Next steps",
    /** The links past the facts' two, as a section. */
    references: "References",
    related: "Related writing",
    pagerLabel: "More projects",
} as const;

/** The pager's sides, for a project and an entry alike: the landmark
 *  names what the titles are. */
export const pagerCopy = {
    previous: "Previous",
    next: "Next",
} as const;

/**
 * The home page: the hero and its sections. UI copy only: the name, the
 * headline, what the owner is open to and the button that answers it,
 * the tagline that heads the close, the projects and the entries are the
 * owner's.
 */
export const homeCopy = {
    /** The hero's one action (CV). */
    routesLabel: "Start here",
    cv: "CV",
    openTo: "Open to",
    projectsAct: {
        title: "Selected projects",
        /** Only while /portfolio holds more than home's three. */
        all: "All projects",
    },
    writingAct: {
        title: "Latest writing",
        /** Only while /blog lists more than home's three. */
        all: "All writing",
    },
    /** The close: the owner's tagline is its heading (`title` names it
     *  for screen readers when the profile has none). */
    contactAct: {
        title: "Contact",
        now: "Current focus",
        /** The way to /contact while there is no Open To answer. */
        message: "Send a message",
    },
} as const;

/**
 * The Now list's groups, by `currentCuriosities[].kind` (lib/crew.ts
 * `nowGroups`): the About page's Current focus.
 */
export const nowKinds = {
    question: "Open questions",
    building: "Building",
    reading: "Reading",
    learning: "Learning",
} as const;

/**
 * About (/about; themed Crew File): the page head and its sections. UI
 * copy only: the headline, the biography and the Now list are the
 * owner's.
 */
export const aboutCopy = {
    themed: "Crew File",
    plain: "About",
    /** The metadata and share card when the profile has no headline. */
    description: "Background and interests.",
    bio: "Background",
    now: "Current focus",
    updated: "Updated",
} as const;

/** The crew record (G6): /about. */
export const crewCopy = {
    recordLabel: "Profile record",
    studying: "Studying",
    previously: "Previously",
    focus: "Focus",
    links: "Links",
} as const;

/** The flight through the timeline: /resume's Timeline view. */
export const trajectoryCopy = {
    /** For a keyboard, beside the views: past the flight, to the list. */
    skip: "Skip to the list",
    /** The flight's section, named for screen readers as its view is. */
    heading: "Timeline",
    rail: "Chapters",
    play: "Play",
    pause: "Pause",
    entry: "Full entry",
    current: "Current",
    openTo: "Open to",
    /** The plan leg: the rail's last stop and the planned orbit's label in
     *  the scene. */
    future: "Future",
    contact: "Contact",
    /** The figure line: what is not to scale, and the maps' credit. */
    figure: "Not to scale · Maps: NASA, Solar System Scope (CC BY 4.0)",
    /** The readout's phase, after its date ("May 2024 · Transfer"); the
     *  plan leg has no readout. */
    phases: {
        coast: "Orbit",
        flyby: "Flyby",
        transfer: "Transfer",
    },
    /** After the flight: to the list. */
    close: "The full record",
} as const;
