/** One clock for the surface tour and lunar launch. Times are in seconds. */
export type JourneyPhase =
    "ready" | "accelerating" | "coasting" | "resetting" | "tour";
export interface JourneySnapshot {
    elapsed: number;
    guidedElapsed: number;
    cycle: number;
    cycleTime: number;
    phase: JourneyPhase;
    guidedActive: boolean;
}

const CYCLE_SECONDS = 36;
const MAX_STEP_SECONDS = 0.25;

export function createJourneyPlayback() {
    let world = "";
    let active = false;
    let visible = false;
    let paused = false;
    let reducedMotion = false;
    let manualOrbit = false;
    let elapsed = 0;
    let guidedElapsed = 0;
    let previousTime: number | undefined;

    const running = () =>
        active &&
        visible &&
        !paused &&
        !reducedMotion &&
        (world === "moon" || world === "mars");
    const snapshot = (): JourneySnapshot => {
        const cycle = Math.floor(elapsed / CYCLE_SECONDS);
        const cycleTime = elapsed - cycle * CYCLE_SECONDS;
        const phase: JourneyPhase =
            world === "moon"
                ? cycleTime < 5
                    ? "ready"
                    : cycleTime < 10
                      ? "accelerating"
                      : cycleTime < 19
                        ? "coasting"
                        : cycleTime < 24
                          ? "resetting"
                          : "ready"
                : "tour";
        return {
            elapsed,
            guidedElapsed,
            cycle,
            cycleTime,
            phase,
            guidedActive: running() && !manualOrbit,
        };
    };
    const resetBaseline = () => {
        previousTime = undefined;
    };
    return {
        setWorld(value: string) {
            if (world === value) return;
            world = value;
            elapsed = 0;
            guidedElapsed = 0;
            manualOrbit = false;
            resetBaseline();
        },
        setActive(value: boolean) {
            if (active !== value) {
                active = value;
                resetBaseline();
            }
        },
        setVisibility(value: boolean) {
            if (visible !== value) {
                visible = value;
                resetBaseline();
            }
        },
        setPaused(value: boolean) {
            if (paused !== value) {
                paused = value;
                resetBaseline();
            }
        },
        setReducedMotion(value: boolean) {
            if (reducedMotion !== value) {
                reducedMotion = value;
                resetBaseline();
            }
        },
        setManualOrbit(value: boolean) {
            if (manualOrbit === value) return;
            manualOrbit = value;
            if (!value) {
                // Replay begins at the next full cycle; a payload is never
                // teleported into the middle of an active launch.
                const boundary =
                    Math.ceil(elapsed / CYCLE_SECONDS) * CYCLE_SECONDS;
                elapsed = boundary;
                guidedElapsed = boundary;
            }
            resetBaseline();
        },
        tick(nowMs: number): JourneySnapshot {
            if (!Number.isFinite(nowMs)) return snapshot();
            if (running() && previousTime !== undefined) {
                const delta = Math.min(
                    MAX_STEP_SECONDS,
                    Math.max(0, (nowMs - previousTime) / 1000),
                );
                elapsed += delta;
                if (!manualOrbit) guidedElapsed += delta;
            }
            previousTime = running() ? nowMs : undefined;
            return snapshot();
        },
    };
}
