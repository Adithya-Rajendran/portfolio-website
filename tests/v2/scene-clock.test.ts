import { afterEach, describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import {
    readSceneClock,
    refreshSceneClock,
    sceneClockBoot,
    waitForSceneClock,
} from "../../src/lib/scene-clock";

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});
function environment(storage = new Map<string, string>()) {
    const document = {
        documentElement: { dataset: {} as Record<string, string> },
    };
    const sessionStorage = {
        getItem: vi.fn((key: string) => storage.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
            storage.set(key, value);
        }),
    };
    return { document, sessionStorage, storage };
}
function boot(
    env: ReturnType<typeof environment>,
    intl: typeof Intl | null = Intl,
) {
    runInNewContext(sceneClockBoot, {
        document: env.document,
        sessionStorage: env.sessionStorage,
        Intl: intl,
        Date,
        JSON,
        Number,
    });
    return env.document.documentElement.dataset;
}

describe("scene clock bootstrap", () => {
    it("executes the emitted inline source and reuses timezone, never the old phase, on a second page", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 0, 15, 6, 30));
        const env = environment();
        const first = boot(env);
        expect(first.sceneClock).toBe("ready");
        expect(first.sceneTimezone).toBeTruthy();
        const count = env.sessionStorage.setItem.mock.calls.length;
        vi.setSystemTime(new Date(2026, 0, 15, 9, 30));
        const second = environment(env.storage);
        const result = boot(second);
        expect(second.sessionStorage.setItem).not.toHaveBeenCalled();
        expect(count).toBe(1);
        expect(result.scenePhase).not.toBe(first.scenePhase);
    });
    it.each([
        [5, "night"],
        [6, "dawn"],
        [9, "day"],
        [17, "dusk"],
        [20, "night"],
    ] as const)("derives the current phase at %i:00", (hour, expected) => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 0, 15, hour));
        const env = environment();
        expect(boot(env).scenePhase).toBe(expected);
    });
    it("recovers from invalid, expired, future, and malformed cached values", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
        for (const raw of [
            "{",
            JSON.stringify({ timezone: "Invalid/Zone", savedAt: Date.now() }),
            JSON.stringify({
                timezone: "UTC",
                savedAt: Date.now() - 7 * 3600_000,
            }),
            JSON.stringify({ timezone: "UTC", savedAt: Date.now() + 1 }),
        ]) {
            const env = environment(
                new Map([["portfolio.scene-timezone.v1", raw]]),
            );
            expect(boot(env).sceneClock).toBe("ready");
            expect(env.sessionStorage.setItem).toHaveBeenCalled();
        }
    });
    it("falls back to the local clock when storage and Intl are unavailable", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 0, 15, 17));
        const env = environment();
        env.sessionStorage.getItem.mockImplementation(() => {
            throw new Error("blocked");
        });
        env.sessionStorage.setItem.mockImplementation(() => {
            throw new Error("blocked");
        });
        expect(boot(env, null)).toMatchObject({
            sceneClock: "ready",
            sceneTimezone: "local",
            scenePhase: "dusk",
        });
    });
    it("client helpers refresh invalid or absent data and do not request network or location", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 0, 15, 8));
        const env = environment();
        vi.stubGlobal("document", env.document);
        vi.stubGlobal("sessionStorage", env.sessionStorage);
        const fetch = vi.fn();
        const location = vi.fn();
        vi.stubGlobal("fetch", fetch);
        vi.stubGlobal("navigator", {
            geolocation: { getCurrentPosition: location },
        });
        expect(readSceneClock()).toBeNull();
        Object.assign(env.document.documentElement.dataset, {
            sceneClock: "ready",
            sceneTimezone: "Not/AZone",
            scenePhase: "day",
        });
        expect(readSceneClock()).toBeNull();
        expect(await waitForSceneClock()).toMatchObject({ phase: "dawn" });
        vi.setSystemTime(new Date(2026, 0, 15, 10));
        expect(refreshSceneClock().phase).toBe("day");
        expect(readSceneClock()?.phase).toBe("day");
        expect(fetch).not.toHaveBeenCalled();
        expect(location).not.toHaveBeenCalled();
    });
});
