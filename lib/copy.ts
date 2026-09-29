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
    motionHeldByOs: "Motion reduced",
    backToTop: "Back to top",
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
    lead: "The page you requested could not be found. It may have moved or no longer exists.",
    home: "Home",
    requested: "Requested",
    sections: "Site sections",
    report: "Found a broken link?",
    reportLink: "Let me know",
} as const;

/** The error page: the same instrument, a different fault. */
export const errorCopy = {
    tag: "Telemetry fault · 500",
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
    routes: "Topics",
    message: "Message",
    elsewhere: "Profiles",
    openTo: "Open to",
    links: {
        resumePdf: "Résumé (PDF)",
        cv: "Experience & CV",
        rss: "RSS",
    },
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
 * Writing (the Flight Log, G8): the index, the archive and the tag pages.
 * The intro is the owner's own writing description from the profile;
 * everything here is UI copy.
 */
export const logCopy = {
    themed: "Flight Log",
    plain: "Writing",
    rss: "RSS",
    linkedIn: "Follow on LinkedIn",
    /** The way to the archive and its search, always in the head. */
    search: "Search the archive",
    tags: "Tags",
    all: "All",
    /** "5 min read", the words after the number for assistive tech. */
    read: (minutes: number) => `${minutes} min`,
    readSuffix: " read",
    updated: "Updated",
    tagList: "Tags",
    empty: "No entries yet.",
    archive: {
        title: "Archive",
        intro: "Every article by year. Search titles, standfirsts and tags.",
        searchLabel: "Search the writing",
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
        /** "Articles tagged homelab." */
        intro: (tag: string) => `Articles tagged ${tag}.`,
    },
    back: "All writing",
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
    tags: "Tags",
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
    allEntries: "All writing",
    after: "After this entry",
    projects: (count: number) =>
        count === 1 ? "Related project" : "Related projects",
    pager: "Previous and next",
    previous: "Previous entry",
    next: "Next entry",
    related: "Related entries",
    author: "Author",
    writtenBy: "Written by",
    rss: "RSS",
    /** The print masthead: "Writing · LOG 003". */
    printKicker: (designation?: string) =>
        designation ? `Writing · ${designation}` : "Writing",
    printFiled: "Filed",
} as const;

/**
 * Experience & CV (themed Trajectory; G2, G3): /resume, its print and the
 * orbit map. UI copy only: roles, dates and the summary are the owner's.
 */
export const cvCopy = {
    themed: "Trajectory",
    /** The page's name in titles and share cards. */
    plain: "Experience & CV",
    /** The h1, as the nav names it: the actions under it say CV. */
    title: "Experience",
    /** The share card and metadata when the profile has no summary. */
    description: "Experience, education and skills.",
    viewLegend: "View",
    /** The CV list first; the orbit map (the Timeline) is the optional
     *  view, named as its section is. */
    views: [
        { value: "list", label: "List" },
        { value: "map", label: "Timeline" },
    ],
    /** Without JavaScript, the link that opens the Timeline. */
    showMap: "Show the timeline",
    contact: "Contact",
    download: "Download CV (PDF)",
    openPdf: "Open PDF",
    print: "Print CV",
    share: "Share",
    shared: "Shared",
    copied: "Link copied",
    announceCopied: "Link to the CV copied.",
    openTo: "Open to",
    /** The sections' plain names, on screen and on paper. */
    map: "Timeline",
    figure: "Fig. 1",
    education: "Education",
    experience: "Experience",
    projects: "Projects",
    allProjects: "All projects",
    writing: {
        title: "Writing",
        withTalks: "Writing & talks",
        talks: "Talks",
    },
    allWriting: "All writing",
    skills: "Skills",
    skillsLabel: "Skills",
    certifications: "Certifications",
    /** A row's button in the Timeline view: its orbit, pinned. */
    showOnMap: "Show on timeline",
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
 * related pages and the About page's. Each row is the destination's plain
 * name and one line about where it leads.
 */
export const directoryCopy = {
    experience: {
        plain: "Experience",
        blurb: "Roles and education, on a timeline and as a CV.",
    },
    skills: {
        plain: "Skills",
        blurb: "Skills by area.",
    },
    certifications: {
        plain: "Certifications",
        blurb: "Certifications and their status.",
    },
    missions: {
        plain: "Projects",
        blurb: "Projects and case studies.",
    },
    writing: {
        plain: "Writing",
        blurb: "Articles and technical notes.",
    },
    contact: {
        plain: "Contact",
        blurb: "Send a message.",
    },
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
    experience: "Experience & CV",
    flagship: "Featured project",
    more: "More projects",
    /** The least prominent projects, under the tiles. */
    also: "Also",
    directory: "Related pages",
    openFile: "View the project",
    readWriteUp: "Read the write-up",
    stack: "Stack",
    /** A project page's share-card alt. */
    file: "Project",
    /** The facts under a project's head (and a note's links). */
    facts: {
        status: "Status",
        stack: "Stack",
        role: "Role",
        links: "Links",
    },
    callouts: "Parts of the build",
    /** A callout whose section is in a post: the mark, and its words for
     *  screen readers ("in A Homelab Built to Be Rebuilt"). */
    calloutWriteUp: "Write-up",
    calloutIn: (title: string) => `in ${title}`,
    briefTitle: "Problem, approach and outcome",
    brief: {
        problem: "Problem",
        approach: "Approach",
        outcome: "Outcome",
    },
    writeUp: "Case study",
    contents: "Contents",
    contentsLabel: "On this page",
    results: "Results",
    /** The results table's number: "Table 1". */
    table: "Table 1",
    resultsCaption: (name: string) => `${name} results`,
    resultColumns: { metric: "Metric", value: "Value", note: "Note" },
    debrief: "Lessons and next steps",
    lessons: "Lessons",
    nextSteps: "Next steps",
    links: "Code and references",
    related: "Related writing",
    question: "Questions about this project?",
    getInTouch: "Get in touch",
    pagerLabel: "More projects",
    previousFile: "Previous project",
    nextFile: "Next project",
    all: "All projects",
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
    pinned: "Selected",
    showing: "Showing",
} as const;

/**
 * The home page: the hero and its sections. UI copy only: the name, the
 * headline, what the owner is open to and the button that answers it,
 * the interests statement, the projects and the entries are the owner's.
 */
export const homeCopy = {
    /** The hero's quick links. */
    routesLabel: "Start here",
    projects: "Projects",
    cv: "CV",
    contact: "Contact",
    openTo: "Open to",
    projectsAct: {
        title: "Selected projects",
        all: "All projects",
        /** The projects past the first three, as one line of links. */
        also: "Also",
    },
    writingAct: {
        title: "Latest writing",
        all: "All writing",
    },
    interestsAct: {
        title: "Research interests",
        now: "Current focus",
    },
    contactAct: {
        title: "Let’s talk.",
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
 * About (/about; themed Crew File): the page head, its sections and the
 * close. UI copy only: the headline, the biography, the Now list, the
 * entries and the talks are the owner's.
 */
export const aboutCopy = {
    themed: "Crew File",
    plain: "About",
    /** The metadata and share card when the profile has no headline. */
    description: "Background and interests.",
    experience: "Experience & CV",
    bio: "Background",
    now: "Current focus",
    updated: "Updated",
    writing: "Writing",
    writingAndTalks: "Writing & talks",
    talks: "Talks and papers",
    allEntries: "All writing",
    elsewhere: "Related pages",
    ask: "Questions or ideas?",
    getInTouch: "Get in touch",
} as const;

/** The crew record (G6): /about. */
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

/** The flight through the timeline on /resume/trajectory. */
export const trajectoryCopy = {
    tag: "Trajectory",
    title: "Experience",
    /** Plain names in the title and description; "Trajectory" is only the
     *  page head's tag. */
    metaTitle: "Experience",
    description:
        "Education and work in order, each linked to its full entry on the CV.",
    heading: "The route",
    rail: "Chapters",
    play: "Play",
    pause: "Pause",
    list: "List view",
    entry: "Full entry",
    current: "Current",
    openTo: "Open to",
    next: "Next",
    contact: "Contact",
    /** The readout's phase; the plan leg has none (its readout is
     *  `next`, as on the rail). */
    phases: {
        coast: "Orbit",
        flyby: "Flyby",
        transfer: "Transfer",
    },
    close: "The full record",
} as const;
