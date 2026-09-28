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
    /** The header's theme switch names the theme it switches to. */
    toLight: "Switch to light theme",
    toDark: "Switch to dark theme",
    holdDrift: "Pause motion",
    resumeDrift: "Resume motion",
    motionHeldByOs: "Motion reduced by system settings",
    backToTop: "Back to top",
    revTitle: "Last revised",
} as const;

/** The theme choices in the footer and the menu sheet, themed over plain. */
export const themeOptions = [
    { value: "void", label: "Void", sub: "Dark" },
    { value: "manual", label: "Manual", sub: "Light" },
    { value: "auto", label: "Auto", sub: "System" },
] as const;

/** Loss of Signal: the 404 (G7). */
export const lossOfSignalCopy = {
    tag: "LOS · 404",
    themed: "Loss of Signal",
    plain: "Page not found",
    lead: "The page you requested could not be found. It may have moved or no longer exists.",
    home: "Home",
    requested: "Requested",
    returnThemed: "Directory",
    returnPlain: "Site sections",
    report: "Found a broken link?",
    reportLink: "Let me know",
} as const;

/** The error page: the same instrument, a different fault. */
export const errorCopy = {
    tag: "ERR · 500",
    themed: "Telemetry fault",
    plain: "Page error",
    lead: "This page failed to load. Please try again.",
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
    intro: "An idea, a question, or an opportunity. I’d like to hear from you.",
    routesThemed: "Routes",
    routesPlain: "Topics",
    messageThemed: "Uplink",
    messagePlain: "Message",
    elsewhereThemed: "Elsewhere",
    elsewherePlain: "Profiles",
    openTo: "Open to",
    include: "Include",
    links: {
        resumePdf: "Résumé (PDF)",
        cv: "Experience & CV",
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
            template: "A question, feedback on an entry, or anything else.",
        },
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
        errors: {
            emailMissing: "Enter your email address, so I can reply.",
            emailInvalid: "Enter an email address like you@example.com.",
            messageMissing: "Write a message before sending.",
            messageLong: (max: number) =>
                `Shorten the message to ${max.toLocaleString("en-US")} characters or fewer.`,
        },
        successTag: "Sent",
        successTitle: "Message sent. Thanks for getting in touch.",
        logTopic: "Topic",
        logFrom: "From",
        logLength: "Length",
        logLengthValue: (length: number, max: number) =>
            `${length.toLocaleString("en-US")} / ${max.toLocaleString("en-US")} characters`,
        again: "Write another message",
    },
    noScript: {
        title: "This form requires JavaScript.",
        body: "You can also reach me on LinkedIn.",
        linkedIn: "Message me on LinkedIn",
        profiles: "You can also reach me through the profiles below.",
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
    follow: "RSS & follow",
    search: "Search entries",
    indexThemed: "Index",
    indexPlain: "All entries",
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
    chart: {
        num: "Fig. 1",
        /** "Entries by date, Mar 2026 to today". */
        what: (from: string) => `Entries by date, ${from} to today`,
        key: "Height = reading time",
        now: "Now",
    },
    downlinkThemed: "Downlink",
    downlinkPlain: "Follow",
    feedLabel: "RSS feed",
    feedNote: "Every new entry, in any feed reader.",
    feedAction: "Open the feed",
    linkedInLabel: "LinkedIn",
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
    reply: "Send a message",
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
    /** The sections, each a themed / plain pair; paper prints the plain
     *  name. */
    map: { themed: "Orbit map", plain: "Timeline" },
    figure: "Fig. 1",
    education: { themed: "Training", plain: "Education" },
    experience: { themed: "Flight record", plain: "Experience" },
    projects: { themed: "Missions", plain: "Projects" },
    allProjects: "All projects",
    writing: {
        themed: "Flight Log",
        plain: "Writing",
        plainWithTalks: "Writing & talks",
        talks: "Talks",
    },
    flightLog: "Flight Log",
    skills: { themed: "Capabilities", plain: "Skills" },
    skillsLabel: "Skills",
    certifications: { themed: "Qualifications", plain: "Certifications" },
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
 * Link rows to the site's other sections (lib/directory.ts): /portfolio's
 * Directory and the Crew File's Elsewhere. Each row is a themed / plain
 * pair and one line about where it leads.
 */
export const directoryCopy = {
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
    missions: {
        themed: "Missions",
        plain: "Projects",
        blurb: "Projects and case studies.",
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

/**
 * The home page (§ 00): the hero and its acts. UI copy only: the name,
 * the headline, the tagline, the roles, the questions, the missions and
 * the entries are the owner's.
 */
export const homeCopy = {
    /** The hero's quick links, CV first. */
    routesLabel: "Start here",
    cv: "Experience & CV",
    work: "Selected work",
    blog: "Read the blog",
    now: "Now",
    openTo: "Open to",
    updated: "Updated",
    nowAct: {
        themed: "Now",
        plain: "Current focus",
        current: "Current",
    },
    missionsAct: {
        themed: "Missions",
        plain: "Projects",
        title: "Selected work",
        all: "All projects",
    },
    logAct: {
        themed: "Flight Log",
        plain: "Blog",
        title: "Latest writing",
        all: "All entries",
        rss: "RSS",
        linkedIn: "Follow on LinkedIn",
    },
    trajectoryAct: {
        themed: "Trajectory",
        plain: "Experience",
        title: "Experience and education",
        all: "Experience & CV",
        resume: "Résumé (PDF)",
    },
    crewAct: {
        themed: "Crew File",
        plain: "About",
        all: "About",
    },
    commsAct: {
        themed: "Comms",
        plain: "Contact",
        title: "Let’s talk.",
        all: "Contact",
        profiles: "Profiles",
    },
} as const;

/**
 * The Now list's groups, by `currentCuriosities[].kind` (lib/crew.ts
 * `nowGroups`): the home Now act and the Crew File.
 */
export const nowKinds = {
    question: "Open questions",
    building: "Building",
    reading: "Reading",
    learning: "Learning",
} as const;

/**
 * Crew File · About (/about, § 04): the page head, its sections and the
 * close. UI copy only: the headline, the biography, the Now list, the
 * entries and the talks are the owner's.
 */
export const aboutCopy = {
    num: "04",
    themed: "Crew File",
    plain: "About",
    /** The metadata and share card when the profile has no headline. */
    description: "Background and interests.",
    experience: "Experience & CV",
    bioThemed: "Biography",
    bioPlain: "Background",
    nowThemed: "Now",
    nowPlain: "Current focus",
    updated: "Updated",
    writingThemed: "Flight Log",
    writingPlain: "Writing",
    writingAndTalksPlain: "Writing & talks",
    talksThemed: "Talks",
    talksPlain: "Talks and papers",
    allEntries: "All entries",
    elsewhereThemed: "Elsewhere",
    elsewherePlain: "Related pages",
    ask: "Interested in working together?",
    getInTouch: "Get in touch",
} as const;

/** The crew record (G6): the home Crew act and /about. */
export const crewCopy = {
    recordLabel: "Profile record",
    name: "Name",
    studying: "Studying",
    previously: "Previously",
    focus: "Focus",
    openTo: "Open to",
    links: "Links",
    updated: "Updated",
} as const;
