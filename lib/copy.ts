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
    /** The primary for a missed address under a section's index. */
    index: { missions: "All projects", log: "All writing" },
    requested: "Requested",
    sections: "Site sections",
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
        /** Under their field, from the form or the server. */
        errors: {
            emailMissing: "Enter your email address.",
            emailInvalid: "Enter an email address like you@example.com.",
            emailDomain:
                "The domain after the @ does not receive email. Check the address.",
            messageMissing: "Write a message before sending.",
            messageLong: (max: number) =>
                `Shorten the message to ${max.toLocaleString("en-US")} characters or fewer.`,
        },
        /** A send that did not go, under Send; `kept` follows each. */
        failures: {
            unsent: "The message could not be sent.",
            unverified:
                "The message could not be verified. Reload the page, then try again.",
            tooMany:
                "Too many messages were sent in a short time. Try again in a few minutes.",
        },
        kept: "Your text is still here.",
        retry: "Try again",
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
    noScript: {
        title: "This form requires JavaScript.",
        body: "You can also reach me on LinkedIn.",
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
    /** "Follow: RSS · LinkedIn", in /blog's head and after an entry. */
    follow: "Follow:",
    tags: "Tags",
    all: "All",
    /** "5 min read", the words after the number for assistive tech. */
    read: (minutes: number) => `${minutes} min`,
    readSuffix: " read",
    updated: "Updated",
    tagList: "Tags",
    empty: "No entries yet.",
    archive: {
        /** The page's name, and the quiet link at the end of /blog. */
        title: "Archive",
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
    tags: "Tags",
    contents: "Contents",
    /** The contents' landmark name (plan §4.5). */
    contentsLabel: "On this page",
    listing: {
        num: (number: number) => `Listing ${number}`,
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
    /** The end mark: the LOG number is the crumb's alone. */
    end: "End of entry",
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
    /** The pager's landmark name (it has no visible heading). */
    pager: "Previous and next",
    previous: "Previous entry",
    next: "Next entry",
    related: "Related entries",
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
    /** Beside the views: the flight (/resume/trajectory). */
    flight: "Timeline in 3D",
    contact: "Contact",
    download: "Download CV (PDF)",
    openTo: "Open to",
    /** The sections' plain names, on screen and on paper. */
    map: "Timeline",
    figure: "Fig. 1",
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
    skillsLabel: "Skills",
    certifications: "Certifications",
    /** Expired credentials, as the résumé names them. */
    priorCertifications: "Prior certifications",
    /** A row's button in the Timeline view: its orbit, pinned. */
    showOnMap: "Show on timeline",
    links: "Links",
    current: "Current",
    /** The printed document's control marks (G3). */
    document: "AR-CV-001",
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
    /** The least prominent projects, under the tiles. */
    also: "Also",
    openFile: "View the project",
    readWriteUp: "Read the write-up",
    stack: "Stack",
    /** A project page's share-card alt. */
    file: "Project",
    /** The facts under a project's head: the repositories are Code, the
     *  other links (two in all, or a note's) Links. */
    facts: {
        status: "Status",
        stack: "Stack",
        code: "Code",
        role: "Role",
        links: "Links",
    },
    callouts: "Parts of the build",
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
    resultColumns: { metric: "Metric", value: "Value", note: "Note" },
    debrief: "Lessons and next steps",
    lessons: "Lessons",
    nextSteps: "Next steps",
    /** The links past the facts' two, as a section. */
    references: "References",
    related: "Related writing",
    question: "Questions about this project?",
    message: "Send a message",
    pagerLabel: "More projects",
    previousFile: "Previous project",
    nextFile: "Next project",
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
 * the tagline that heads the close, the projects and the entries are the
 * owner's.
 */
export const homeCopy = {
    /** The hero's action (CV) and its quiet link down to the projects
     *  (the section's title). */
    routesLabel: "Start here",
    cv: "CV",
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
    /** The close: the owner's tagline is its heading (`title` names it
     *  for screen readers when the profile has none). */
    contactAct: {
        title: "Contact",
        now: "Current focus",
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
 * close. UI copy only: the headline, the biography and the Now list are
 * the owner's.
 */
export const aboutCopy = {
    themed: "Crew File",
    plain: "About",
    /** The metadata and share card when the profile has no headline. */
    description: "Background and interests.",
    bio: "Background",
    now: "Current focus",
    updated: "Updated",
    ask: "Questions or ideas?",
    message: "Send a message",
} as const;

/** The crew record (G6): /about. */
export const crewCopy = {
    recordLabel: "Profile record",
    name: "Name",
    studying: "Studying",
    previously: "Previously",
    focus: "Focus",
    links: "Links",
} as const;

/** The flight through the timeline on /resume/trajectory. */
export const trajectoryCopy = {
    /** The share card's small tag. */
    tag: "Trajectory",
    /** The crumb: the section, then the page's small h1 (and its title). */
    section: "Experience",
    title: "Timeline",
    description:
        "Education and work in order, each linked to its full entry on the CV.",
    /** In the head: past the flight, to the CV's list. */
    skip: "Skip to the list",
    heading: "The route",
    rail: "Chapters",
    play: "Play",
    pause: "Pause",
    entry: "Full entry",
    current: "Current",
    openTo: "Open to",
    /** The rail's last stop: what the owner is open to. */
    next: "Next",
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
    close: "The full record",
} as const;
