import { afterEach, describe, expect, it, vi } from "vitest";
import { getScenePhase } from "../../src/lib/scene-time";

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe("local scene phase", () => {
    it.each([
        [0, 0, "night"],
        [5, 59, "night"],
        [6, 0, "dawn"],
        [8, 59, "dawn"],
        [9, 0, "day"],
        [16, 59, "day"],
        [17, 0, "dusk"],
        [19, 59, "dusk"],
        [20, 0, "night"],
        [23, 59, "night"],
    ] as const)("uses %02i:%02i local time as %s", (hour, minute, phase) => {
        expect(getScenePhase(new Date(2026, 0, 15, hour, minute))).toBe(phase);
    });

    it("uses local time rather than the UTC hour", () => {
        const date = new Date("2026-01-15T12:00:00Z");
        vi.spyOn(date, "getHours").mockReturnValue(7);
        expect(date.getUTCHours()).toBe(12);
        expect(getScenePhase(date)).toBe("dawn");
    });

    it("uses the current clock by default without network access", () => {
        vi.useFakeTimers();
        try {
            vi.setSystemTime(new Date(2026, 0, 15, 17, 0));
            const fetch = vi.spyOn(globalThis, "fetch");
            const geolocation = vi.fn();
            vi.stubGlobal("navigator", {
                geolocation: { getCurrentPosition: geolocation },
            });
            expect(getScenePhase()).toBe("dusk");
            expect(fetch).not.toHaveBeenCalled();
            expect(geolocation).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });
});
