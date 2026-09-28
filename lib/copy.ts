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
