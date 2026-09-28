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
} as const;

/**
 * The Flight Log (G8): the index, the archive and the tag pages. The intro
 * is the owner's own writing description from the profile; everything here
 * is UI copy.
 */
export const logCopy = {
    num: "01",
    themed: "Flight Log",
    plain: "Blog",
    /** The page-head meta: "3 entries · since Mar 2026". */
    meta: (entries: string, since: string) =>
        since ? `${entries} · since ${since}` : entries,
    follow: "RSS & follow",
    search: "Search entries",
    indexThemed: "Index",
    indexPlain: "All entries",
    /** The index's status line: "Showing all 3 entries, newest first." */
    showing: (entries: string) => `Showing all ${entries}, newest first.`,
    tags: "Tags",
    all: "All",
    /** Column heads of the log index. */
    columns: {
        entry: "Entry",
        filed: "Filed",
        title: "Title · standfirst",
        read: "Read",
    },
    read: (minutes: number) => `${minutes} min`,
    readSuffix: " read",
    tagList: "Tags",
    empty: "No entries yet.",
    emptyNote: "Entries appear here as they are filed.",
    chart: {
        num: "Fig. 1",
        /** "Transmissions, Mar 2026 to now · 3 entries · 2,863 words". */
        what: (from: string, entries: string, words: number) =>
            `Transmissions, ${from} to now · ${entries} · ${words.toLocaleString("en-US")} words`,
        key: "Height = reading time",
        now: "Now",
    },
    downlinkThemed: "Downlink",
    downlinkPlain: "Follow",
    feedLabel: "RSS feed",
    feedNote: "Every new entry, in any feed reader.",
    feedAction: "Open the feed",
    linkedInLabel: "LinkedIn",
    linkedInNote: "Follow along there.",
    linkedInAction: "Follow on LinkedIn",
    archive: {
        themed: "Archive",
        plain: "All entries",
        title: "Archive",
        intro: "Every Flight Log entry by year. Search titles, standfirsts and tags.",
        searchLabel: "Search the Flight Log",
        searchPlaceholder: "A title, a word or a tag",
        /** "2 of 3 entries" while a search is on. */
        count: (shown: number, entries: string) =>
            `${shown.toLocaleString("en-US")} of ${entries}`,
        noMatch: "No entries match.",
        noMatchNote: (query: string) =>
            `Nothing in the log matches “${query}”. Try another word or tag.`,
        clear: "Clear search",
    },
    tag: {
        themed: "Subsystem",
        plain: "Tag",
        /** "Entries tagged homelab." */
        intro: (tag: string) => `Flight Log entries tagged ${tag}.`,
    },
    back: "Flight Log index",
} as const;

/**
 * A Flight Log entry (G1, the paper-grade post). UI copy only: the title,
 * standfirst, text, captions, notes and changelog are the owner's.
 */
export const postCopy = {
    num: "01",
    themed: "Flight Log",
    plain: "Blog",
    /** "7 min read". */
    read: (minutes: number) => `${minutes} min read`,
    updated: "Updated",
    tags: "Tags",
    record: {
        title: "In this entry",
        entry: "Entry",
        of: "of",
        filed: "Filed",
        length: "Length",
        minutes: (minutes: number) => `${minutes} min`,
        inside: "Inside",
        mission: "Mission",
        missions: "Missions",
        revised: "Revised",
    },
    contents: "Contents",
    /** The contents' landmark name (plan §4.5). */
    contentsLabel: "On this page",
    listing: {
        num: (number: number) => `Listing ${number}`,
        lines: (lines: number) => `${lines} ${lines === 1 ? "line" : "lines"}`,
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
    revisions: {
        title: "Revisions",
        /** "△ Rev 2026-07-02 · Correction". */
        rev: "Rev",
    },
    /** "End of entry LOG 003". */
    end: (designation?: string) =>
        designation ? `End of entry ${designation}` : "End of entry",
    question: "Questions about this entry?",
    reply: "Reply via Comms",
    copyLink: "Copy link",
    /** Starts with the visible label, for voice control (WCAG 2.5.3). */
    copyLinkLabel: "Copy link to this entry",
    linkCopied: "Link copied",
    allEntries: "All entries",
    after: "After this entry",
    missionThemed: "Mission file",
    missionPlain: (count: number) =>
        count === 1 ? "Related project" : "Related projects",
    pagerThemed: "Keep reading",
    pagerPlain: "Previous and next",
    previous: "Previous entry",
    next: "Next entry",
    first: "This is the first entry.",
    latest: "This is the latest entry.",
    relatedThemed: "Same subsystem",
    relatedPlain: "Related entries",
    crewThemed: "Crew",
    crewPlain: "Author",
    writtenBy: "Written by",
    rss: "RSS",
    /** The print masthead: "Flight Log · LOG 003". */
    printKicker: (designation: string) => `Flight Log · ${designation}`,
    printFiled: "Filed",
} as const;

/**
 * Trajectory · Experience / CV (G2, G3): /resume, its print and the
 * orbit map. UI copy only: roles, dates and the summary are the owner's.
 */
export const cvCopy = {
    num: "03",
    themed: "Trajectory",
    plain: "Experience / CV",
    /** The share card and metadata when the profile has no summary. */
    description: "Experience, education and skills.",
    viewLegend: "View",
    views: [
        { value: "map", label: "Orbit map" },
        { value: "list", label: "CV list" },
    ],
    download: "Download CV (PDF)",
    openPdf: "Open PDF",
    print: "Print CV",
    share: "Share",
    shared: "Shared",
    copied: "Link copied",
    announceCopied: "Link to the CV copied.",
    openTo: "Open to",
    writeAboutRole: "Write about a role",
    mapTitle: "Orbit map",
    figure: "Fig. 1",
    education: "Education",
    experience: "Experience",
    projects: "Projects",
    allProjects: "All projects",
    writing: "Writing",
    writingAndTalks: "Writing & talks",
    talks: "Talks",
    flightLog: "Flight Log",
    skills: "Skills",
    certifications: "Certifications",
    showOnMap: "Show on map",
    stack: "Stack",
    links: "Links",
    current: "Current",
    /** The printed document's control marks (G3). */
    document: "AR-CV-001",
    documentTitle: "Curriculum vitae",
    sheet: (sheet: number, of: number) => `Sheet ${sheet} of ${of}`,
} as const;

/**
 * Missions · Projects (G5, G6): the /portfolio index and the mission files.
 * UI copy only: names, titles, summaries, parameters, briefs, results and
 * lessons are the owner's.
 */
export const missionsCopy = {
    num: "02",
    themed: "Missions",
    plain: "Projects",
    /** "Selected projects in infrastructure and software." */
    dek: (types: string) =>
        types ? `Selected projects in ${types}.` : "Selected projects.",
    tallyLabel: "Projects by status",
    experience: "Experience & CV",
    flagshipThemed: "Flagship",
    flagshipPlain: "Featured project",
    moreThemed: "Also flown",
    morePlain: "More projects",
    registerThemed: "Register",
    registerPlain: "All projects",
    /** The register's caption. */
    table: "Table 1",
    registerCaption: "Every project by code, status and dates.",
    columns: {
        code: "Code",
        mission: "Mission",
        type: "Type",
        status: "Status",
        dates: "Dates",
        links: "Links",
    },
    file: "File",
    directoryThemed: "Directory",
    directoryPlain: "Related pages",
    directory: {
        experience: {
            themed: "Trajectory",
            plain: "Experience",
            blurb: "Roles and education, on the orbit map and as a CV.",
        },
        skills: {
            themed: "Trajectory",
            plain: "Skills",
            blurb: "Skills by area.",
        },
        certifications: {
            themed: "Trajectory",
            plain: "Certifications",
            blurb: "Certifications and their status.",
        },
        writing: {
            themed: "Flight Log",
            plain: "Blog",
            blurb: "Articles and technical notes.",
        },
        contact: {
            themed: "Comms",
            plain: "Contact",
            blurb: "Send a message about a project or a role.",
        },
    },
    openFile: "Open the mission file",
    readWriteUp: "Read the write-up",
    stack: "Stack",
    /** The mission file. */
    fileThemed: "Mission file",
    filePlain: "Project",
    originalEntry: (designation: string) => `Original entry · ${designation}`,
    parameters: "Parameters",
    record: {
        mission: "Mission",
        status: "Status",
        type: "Type",
        dates: "Dates",
        role: "Role",
        stack: "Stack",
        revision: "Revision",
    },
    calloutsThemed: "Callouts",
    calloutsPlain: "Parts of the build",
    briefThemed: "Brief",
    briefPlain: "Problem, approach and outcome",
    brief: {
        problem: "Problem",
        approach: "Approach",
        outcome: "Outcome",
    },
    writeUpThemed: "Write-up",
    writeUpPlain: "Case study",
    contents: "Contents",
    contentsLabel: "On this page",
    resultsThemed: "Results",
    resultsPlain: "Outcomes",
    resultsCaption: (name: string) => `${name} results`,
    resultColumns: { metric: "Metric", value: "Value", note: "Note" },
    debriefThemed: "Debrief",
    debriefPlain: "Lessons and next steps",
    lessons: "Lessons",
    nextSteps: "Next steps",
    linksThemed: "Links",
    linksPlain: "Code and references",
    relatedThemed: "Flight Log",
    relatedPlain: "Related entries",
    question: "Questions about this project?",
    getInTouch: "Get in touch",
    pagerLabel: "More mission files",
    previousFile: "Previous file",
    nextFile: "Next file",
    all: "All missions",
} as const;

/** The orbit map's labels, key and record panel (G2). */
export const orbitCopy = {
    /** 3 → "Orbit 03". */
    designation: (number: number) => `Orbit ${String(number).padStart(2, "0")}`,
    hint: "Select an orbit to see its record.",
    caption: "Roles over time, to scale.",
    key: {
        orbit: "Role",
        current: "Current",
        burn: "Change of role",
        planned: "Planned",
    },
    planned: "Planned",
    education: "Education",
    role: "Role",
    current: "Current",
    earlier: "Earlier",
    later: "Later",
    fullRecord: "Full record",
    writeAboutRole: "Write about a role",
    pinned: "Selected",
    showing: "Showing",
} as const;
