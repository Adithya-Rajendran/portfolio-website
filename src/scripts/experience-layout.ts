/** Coordinate the mobile reading layout without moving focus or scrolling the page. */
export function setupExperienceLayout(section: HTMLElement): () => void {
    const page = section.closest<HTMLElement>(".experience-page");
    const grid = page?.querySelector<HTMLElement>(".trajectory-grid");
    const aside = page?.querySelector<HTMLElement>(".trajectory-orbit");
    const story = page?.querySelector<HTMLElement>(".trajectory-story");
    const button = section.querySelector<HTMLButtonElement>(
        "[data-experience-expand]",
    );
    if (!grid || !aside || !story || !button) return () => {};

    const narrow = window.matchMedia("(max-width: 800px)");
    let expanded = false;
    let frame = 0;
    const isPastThreshold = () =>
        window.scrollY > grid.getBoundingClientRect().top + window.scrollY + 80;
    const update = () => {
        frame = 0;
        const layout = !narrow.matches
            ? "arrival"
            : expanded
              ? "expanded"
              : isPastThreshold()
                ? "compact"
                : "arrival";
        section.dataset.layout = layout;
        if (page) page.dataset.experienceLayout = layout;
        button.setAttribute(
            "aria-expanded",
            String(narrow.matches && expanded),
        );
        button.textContent =
            narrow.matches && expanded ? "Back to reading" : "Explore";
        const rect = aside.getBoundingClientRect();
        const occlusion =
            narrow.matches && rect.top <= 1
                ? Math.max(
                      0,
                      rect.bottom + 12 - story.getBoundingClientRect().top,
                  )
                : 0;
        story.style.setProperty("--story-occlusion", `${occlusion}px`);
    };
    const schedule = () => {
        if (!frame) frame = window.requestAnimationFrame(update);
    };
    const toggle = () => {
        if (!narrow.matches) return;
        expanded = !expanded;
        update();
    };
    const keydown = (event: KeyboardEvent) => {
        if (event.key !== "Escape" || !expanded || !narrow.matches) return;
        event.preventDefault();
        expanded = false;
        update();
        button.focus({ preventScroll: true });
    };
    const mediaChanged = () => {
        expanded = false;
        update();
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(aside);
    button.addEventListener("click", toggle);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("keydown", keydown);
    narrow.addEventListener("change", mediaChanged);
    update();
    return () => {
        if (frame) window.cancelAnimationFrame(frame);
        observer.disconnect();
        button.removeEventListener("click", toggle);
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
        window.removeEventListener("keydown", keydown);
        narrow.removeEventListener("change", mediaChanged);
        story.style.removeProperty("--story-occlusion");
    };
}
