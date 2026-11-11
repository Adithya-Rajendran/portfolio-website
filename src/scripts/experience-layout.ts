/** Coordinate the mobile reading layout without moving focus or scrolling the page. */
export function setupExperienceLayout(section: HTMLElement) {
    const page = section.closest<HTMLElement>(".experience-page");
    const grid = page?.querySelector<HTMLElement>(".trajectory-grid");
    const aside = page?.querySelector<HTMLElement>(".trajectory-orbit");
    const story = page?.querySelector<HTMLElement>(".trajectory-story");
    if (!grid || !aside || !story) return;

    const narrow = window.matchMedia("(max-width: 800px)");
    let frame = 0;
    const update = () => {
        const layout = !narrow.matches
            ? "arrival"
            : section.dataset.exploring === "true"
              ? "expanded"
              : grid.getBoundingClientRect().top < -80
                ? "compact"
                : "arrival";
        if (section.dataset.layout !== layout) section.dataset.layout = layout;
        if (page && page.dataset.experienceLayout !== layout)
            page.dataset.experienceLayout = layout;
        let occlusion = 0;
        if (narrow.matches) {
            const rect = aside.getBoundingClientRect();
            if (rect.top <= 1)
                occlusion = Math.max(
                    0,
                    rect.bottom + 12 - story.getBoundingClientRect().top,
                );
        }
        const mask = `${occlusion}px`;
        if (story.style.getPropertyValue("--story-occlusion") !== mask)
            story.style.setProperty("--story-occlusion", mask);
    };
    const schedule = () => {
        if (!frame)
            frame = window.requestAnimationFrame(() => {
                frame = 0;
                update();
            });
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(aside);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    narrow.addEventListener("change", schedule);
    update();
    return {
        update,
        dispose() {
            if (frame) window.cancelAnimationFrame(frame);
            observer.disconnect();
            window.removeEventListener("scroll", schedule);
            window.removeEventListener("resize", schedule);
            narrow.removeEventListener("change", schedule);
            story.style.removeProperty("--story-occlusion");
        },
    };
}
