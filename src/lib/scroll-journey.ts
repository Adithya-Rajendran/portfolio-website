/** Keep named destinations attached to their record as CMS entries change. */
export function experienceWorld(entry: {
    organization: string;
    orgShort?: string | null;
}) {
    const name = `${entry.orgShort || ""} ${entry.organization}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    if (/\bsjsu\b|san jose state/.test(name)) return "earth";
    if (/\bcanonical\b/.test(name)) return "moon";
    if (/\btcr\b|technical consulting.*research/.test(name)) return "mars";
    if (/\bucsc\b|california,?\s+santa cruz/.test(name)) return "jupiter";
    return undefined;
}

/** The camera visits a whole reading region, never a precise scroll coordinate. */
export function createScrollJourney() {
    let current = 0;

    return {
        get current() {
            return current;
        },
        select(world: number) {
            current = world;
        },
        update(
            scrollY: number,
            stops: readonly number[],
            viewportHeight: number,
        ) {
            if (stops.length < 2) return current;
            const boundary = (left: number, direction: 1 | -1) => {
                const gap = stops[left + 1] - stops[left];
                const margin = Math.min(
                    gap * 0.15,
                    Math.max(48, viewportHeight * 0.12),
                );
                return (stops[left] + stops[left + 1]) / 2 + direction * margin;
            };
            while (
                current < stops.length - 1 &&
                scrollY >= boundary(current, 1)
            )
                current++;
            while (current > 0 && scrollY <= boundary(current - 1, -1))
                current--;
            return current;
        },
    };
}
