/** Measure the visible reading area, not a fixed percentage of a browser height. */
export function createExperienceNavigation(
    section: HTMLElement,
    worlds: readonly string[],
) {
    const entries = [
        ...document.querySelectorAll<HTMLElement>("[data-journey-step]"),
    ];
    const aside = section.closest<HTMLElement>(".trajectory-orbit");
    const header = document.querySelector<HTMLElement>("body > header");
    const narrow = matchMedia("(max-width: 800px)");
    const targets = worlds.map(
        (world, index) =>
            document.querySelector<HTMLElement>(
                `[data-journey-world="${world}"]`,
            ) ||
            entries[Math.min(index, entries.length - 1)] ||
            document.querySelector<HTMLElement>(".trajectory-next"),
    );

    function readingArea(expectSticky = false) {
        const viewport = window.visualViewport;
        let top = viewport?.offsetTop || 0;
        const bottom = top + (viewport?.height || innerHeight);
        if (
            header &&
            ["fixed", "sticky"].includes(getComputedStyle(header).position)
        ) {
            const rect = header.getBoundingClientRect();
            if (rect.top <= top + 1) top = Math.max(top, rect.bottom);
        }
        if (narrow.matches && aside) {
            const rect = aside.getBoundingClientRect();
            if (expectSticky || rect.top <= top + 1)
                top = Math.max(
                    top,
                    (expectSticky ? rect.height : rect.bottom) + 16,
                );
        }
        return { top: Math.min(top, bottom - 80), bottom };
    }

    function positionFor(index: number, expectSticky = false) {
        const entry = targets[index];
        if (!entry) return 0;
        const { top, bottom } = readingArea(expectSticky);
        const rect = entry.getBoundingClientRect();
        // Exclude the timeline's inter-entry padding from its visual centre.
        let contentBottom =
            entry.lastElementChild?.getBoundingClientRect().bottom ||
            rect.bottom;
        if (contentBottom - rect.top > bottom - top - 32) {
            // A tall entry cannot all fit. Keep its title, organisation and
            // introduction visible instead of landing halfway down the bullets.
            const intro = [
                ...entry.querySelectorAll<HTMLElement>(
                    "[data-journey-focus-end]",
                ),
            ].at(-1);
            contentBottom =
                intro?.getBoundingClientRect().bottom ||
                Math.min(contentBottom, rect.top + (bottom - top) * 0.6);
        }
        const destination =
            scrollY + (rect.top + contentBottom) / 2 - (top + bottom) / 2;
        return Math.min(
            Math.max(0, document.documentElement.scrollHeight - innerHeight),
            Math.max(0, destination),
        );
    }

    return { targets, positionFor };
}
