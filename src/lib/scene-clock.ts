import type { ScenePhase } from "./scene-time";

export interface SceneClockValue {
    timezone: string;
    phase: ScenePhase;
}

/** Kept self-contained: its compiled source is also the synchronous inline bootstrap. */
function bootstrapSceneClock(): SceneClockValue {
    const root = document.documentElement;
    root.dataset.sceneClock = "pending";
    const key = "portfolio.scene-timezone.v1";
    const maxAge = 6 * 60 * 60 * 1000;
    const now = new Date();
    let timezone = "local";
    let phase: ScenePhase = "night";
    try {
        let cached = "";
        try {
            const raw = sessionStorage.getItem(key);
            if (raw) {
                const item = JSON.parse(raw) as {
                    timezone?: unknown;
                    savedAt?: unknown;
                };
                if (
                    typeof item.timezone === "string" &&
                    item.timezone.length <= 100 &&
                    typeof item.savedAt === "number" &&
                    Number.isFinite(item.savedAt) &&
                    item.savedAt <= now.getTime() &&
                    now.getTime() - item.savedAt < maxAge
                )
                    cached = item.timezone;
            }
        } catch {
            /* Storage can be disabled or contain invalid data. */
        }
        const valid = (value: string) => {
            if (!value || value === "local") return false;
            try {
                new Intl.DateTimeFormat("en-US", { timeZone: value }).format(
                    now,
                );
                return true;
            } catch {
                return false;
            }
        };
        if (valid(cached)) timezone = cached;
        else {
            const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (valid(detected)) {
                timezone = detected;
                try {
                    sessionStorage.setItem(
                        key,
                        JSON.stringify({ timezone, savedAt: now.getTime() }),
                    );
                } catch {
                    /* Storage is optional. */
                }
            }
        }
    } catch {
        /* Local Date remains available without Intl. */
    }
    let hour = now.getHours();
    if (timezone !== "local") {
        try {
            const part = new Intl.DateTimeFormat("en-US", {
                timeZone: timezone,
                hour: "numeric",
                hourCycle: "h23",
            })
                .formatToParts(now)
                .find((item) => item.type === "hour");
            const parsed = Number(part?.value);
            if (part && Number.isInteger(parsed) && parsed >= 0 && parsed <= 23)
                hour = parsed;
        } catch {
            timezone = "local";
        }
    }
    if (hour >= 6 && hour < 9) phase = "dawn";
    else if (hour >= 9 && hour < 17) phase = "day";
    else if (hour >= 17 && hour < 20) phase = "dusk";
    root.dataset.sceneTimezone = timezone;
    root.dataset.scenePhase = phase;
    root.dataset.sceneClock = "ready";
    return { timezone, phase };
}

/** Inline before visual styles or scripts; no module dependencies or network calls. */
export const sceneClockBoot = `(${bootstrapSceneClock.toString()})();`;

export function readSceneClock(): SceneClockValue | null {
    const root = document.documentElement;
    const timezone = root.dataset.sceneTimezone;
    const phase = root.dataset.scenePhase;
    if (
        root.dataset.sceneClock !== "ready" ||
        !timezone ||
        timezone.length > 100 ||
        !["dawn", "day", "dusk", "night"].includes(phase || "")
    )
        return null;
    if (timezone !== "local") {
        try {
            new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
        } catch {
            return null;
        }
    }
    return { timezone, phase: phase as ScenePhase };
}

export function refreshSceneClock(): SceneClockValue {
    return bootstrapSceneClock();
}

/** Resolve only with a complete, valid clock; recover if inline bootstrap was blocked. */
export function waitForSceneClock(): Promise<SceneClockValue> {
    return Promise.resolve(readSceneClock() ?? refreshSceneClock());
}
