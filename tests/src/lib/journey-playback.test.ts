import { describe, expect, it } from "vitest";
import { createJourneyPlayback } from "../../../src/lib/journey-playback";

function setup(world = "moon") {
    const clock = createJourneyPlayback();
    clock.setWorld(world);
    clock.setActive(true);
    clock.setVisibility(true);
    clock.tick(0);
    let now = 0;
    return {
        clock,
        advance(seconds: number) {
            for (let i = 0; i < seconds * 4; i++) {
                now += 250;
                clock.tick(now);
            }
            return clock.tick(now);
        },
        now: () => now,
    };
}

describe("journey playback", () => {
    it("reports the lunar phases at the 36-second schedule boundaries", () => {
        const run = setup();
        expect(run.clock.tick(0).phase).toBe("ready");
        expect(run.advance(5).phase).toBe("accelerating");
        expect(run.advance(5).phase).toBe("coasting");
        expect(run.advance(9).phase).toBe("resetting");
        expect(run.advance(5).phase).toBe("ready");
        expect(run.advance(12)).toMatchObject({
            phase: "ready",
            cycle: 1,
            cycleTime: 0,
            elapsed: 36,
        });
    });
    it("does not consume wall time during visibility, pause, reduced motion or reveal freezes", () => {
        for (const control of [
            "setVisibility",
            "setActive",
            "setPaused",
            "setReducedMotion",
        ] as const) {
            const run = setup();
            run.advance(1);
            const freezeValue =
                control === "setVisibility" || control === "setActive"
                    ? false
                    : true;
            run.clock[control](freezeValue);
            expect(run.clock.tick(100_000).elapsed).toBe(1);
            run.clock[control](!freezeValue);
            expect(run.clock.tick(200_000).elapsed).toBe(1);
            expect(run.clock.tick(200_250).elapsed).toBe(1.25);
        }
    });
    it("freezes guided movement during manual orbit while launch time advances and replays safely", () => {
        const run = setup();
        run.advance(6);
        run.clock.setManualOrbit(true);
        run.clock.tick(run.now());
        const manual = run.advance(3);
        expect(manual).toMatchObject({
            elapsed: 9,
            guidedElapsed: 6,
            guidedActive: false,
        });
        run.clock.setManualOrbit(false);
        expect(run.clock.tick(run.now())).toMatchObject({
            elapsed: 36,
            guidedElapsed: 36,
            cycle: 1,
            cycleTime: 0,
            phase: "ready",
            guidedActive: true,
        });
        expect(run.advance(1)).toMatchObject({
            elapsed: 37,
            guidedElapsed: 37,
        });
    });
    it("caps long frames, ignores backwards time, and restarts on world entry", () => {
        const run = setup();
        expect(run.clock.tick(10_000).elapsed).toBe(0.25);
        expect(run.clock.tick(9_000).elapsed).toBe(0.25);
        run.clock.setWorld("mars");
        expect(run.clock.tick(20_000)).toMatchObject({
            elapsed: 0,
            guidedElapsed: 0,
            phase: "tour",
        });
        expect(run.clock.tick(20_250).elapsed).toBe(0.25);
        run.clock.setWorld("earth");
        expect(run.clock.tick(25_000)).toMatchObject({
            elapsed: 0,
            guidedActive: false,
        });
        expect(run.clock.tick(26_000).elapsed).toBe(0);
    });
});
