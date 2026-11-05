import { expect, test, type Page } from "@playwright/test";

type Pose = {
    time: number;
    camera: number[];
    target: number[];
    up: number[];
    quaternion: number[];
    clearance: number;
    owner: string;
    surface: number;
};

async function recordPoses(page: Page) {
    await page.evaluate(() => {
        const stage = document.querySelector<HTMLElement>(
            "[data-experience-stage]",
        )!;
        const poses: Pose[] = [];
        Object.assign(window, { cameraHandoffPoses: poses });
        const numbers = (value: string | undefined) =>
            (value ?? "").split(",").map(Number);
        new MutationObserver(() => {
            const {
                camera,
                cameraTarget,
                cameraUp,
                cameraQuaternion,
                cameraClearance,
                cameraOwner,
                surfaceProgress,
            } = stage.dataset;
            if (
                !camera ||
                !cameraTarget ||
                !cameraUp ||
                !cameraQuaternion ||
                cameraClearance === undefined ||
                !cameraOwner
            )
                return;
            poses.push({
                time: performance.now(),
                camera: numbers(camera),
                target: numbers(cameraTarget),
                up: numbers(cameraUp),
                quaternion: numbers(cameraQuaternion),
                clearance: Number(cameraClearance),
                owner: cameraOwner,
                surface: Number(surfaceProgress),
            });
        }).observe(stage, {
            attributes: true,
            attributeFilter: ["data-camera"],
        });
    });
}

async function takePoses(page: Page): Promise<Pose[]> {
    return page.evaluate(() => {
        const state = window as unknown as { cameraHandoffPoses: Pose[] };
        return state.cameraHandoffPoses.splice(0);
    });
}

function assertSafe(poses: Pose[]) {
    expect(poses.length).toBeGreaterThan(2);
    for (const pose of poses) {
        expect(
            [
                ...pose.camera,
                ...pose.target,
                ...pose.up,
                ...pose.quaternion,
                pose.clearance,
            ].every(Number.isFinite),
        ).toBe(true);
        expect(pose.camera).toHaveLength(3);
        expect(pose.target).toHaveLength(3);
        expect(pose.up).toHaveLength(3);
        expect(pose.quaternion).toHaveLength(4);
        expect(Math.hypot(...pose.up)).toBeCloseTo(1, 2);
        expect(Math.hypot(...pose.quaternion)).toBeCloseTo(1, 2);
        expect(pose.clearance).toBeGreaterThan(0);
    }
}

function assertContinuous(poses: Pose[]) {
    assertSafe(poses);
    for (let i = 1; i < poses.length; i++) {
        const before = poses[i - 1],
            after = poses[i];
        const distance = (a: number[], b: number[]) =>
            Math.hypot(...a.map((value, n) => value - b[n]));
        expect(
            distance(before.camera, after.camera),
            JSON.stringify({ before, after }),
        ).toBeLessThan(1);
        expect(
            distance(before.target, after.target),
            JSON.stringify({ before, after }),
        ).toBeLessThan(1);
        const dot = Math.abs(
            before.quaternion.reduce(
                (sum, value, n) => sum + value * after.quaternion[n],
                0,
            ),
        );
        const angle = 2 * Math.acos(Math.min(1, dot));
        expect(angle).toBeLessThan(Math.PI / 4);
    }
}

async function openExperience(page: Page) {
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/resume");
    const stage = page.locator("[data-experience-stage]");
    await expect(stage).toHaveAttribute("data-ready", "true", {
        timeout: 60000,
    });
    await recordPoses(page);
    return stage;
}

test("Moon descent and rapid reversals preserve a continuous safe camera", async ({
    page,
}) => {
    test.setTimeout(180_000);
    const stage = await openExperience(page);
    await page.getByRole("button", { name: "Moon", exact: true }).click();
    await expect(stage).toHaveAttribute("data-view", "surface", {
        timeout: 90000,
    });
    const descent = await takePoses(page);
    expect(descent.some((pose) => pose.surface < 0.5)).toBe(true);
    expect(descent.some((pose) => pose.surface > 0.5)).toBe(true);
    assertContinuous(descent);
    for (const world of ["Mars", "Earth", "Moon", "Earth"]) {
        await page.getByRole("button", { name: world, exact: true }).click();
    }
    await expect(stage).toHaveAttribute("data-world", "earth", {
        timeout: 60000,
    });
    assertContinuous(await takePoses(page));
});

test("manual orbit holds while paused and hands off safely to scrolling and replay", async ({
    page,
}) => {
    test.setTimeout(180_000);
    const stage = await openExperience(page);
    await page.getByRole("button", { name: "Moon", exact: true }).click();
    await expect(stage).toHaveAttribute("data-view", "surface", {
        timeout: 90000,
    });
    const box = await stage.boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error("Experience stage has no bounds");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
        box.x + box.width / 2 + 80,
        box.y + box.height / 2 + 20,
        { steps: 8 },
    );
    await page.mouse.up();
    await expect(stage).toHaveAttribute("data-camera-owner", "manual");
    await page.locator("[data-experience-motion]").click();
    await expect(stage).toHaveAttribute("data-state", "paused");
    const held = await stage.getAttribute("data-camera");
    await page.waitForTimeout(1000);
    expect(await stage.getAttribute("data-camera")).toBe(held);
    assertSafe(await takePoses(page));
    await page.locator("[data-experience-motion]").click();
    await takePoses(page);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(stage).toHaveAttribute("data-world", "earth", {
        timeout: 60000,
    });
    await expect(stage).toHaveAttribute("data-camera-owner", "guided", {
        timeout: 60000,
    });
    const handoff = await takePoses(page);
    expect(handoff.some((pose) => pose.owner === "returning")).toBe(true);
    assertContinuous(handoff);
    await page.getByRole("button", { name: "Replay the guided tour" }).click();
    await expect(stage).toHaveAttribute("data-camera-owner", "guided");
});

test("reduced motion selects a safe surface pose without a travelling camera", async ({
    page,
}) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/resume");
    const stage = page.locator("[data-experience-stage]");
    await expect(stage).toHaveAttribute("data-ready", "true", {
        timeout: 60000,
    });
    await recordPoses(page);
    await page.getByRole("button", { name: "Moon", exact: true }).click();
    await expect(stage).toHaveAttribute("data-view", "surface", {
        timeout: 60000,
    });
    await expect(stage).toHaveAttribute("data-state", "paused");
    const camera = await stage.getAttribute("data-camera");
    await page.waitForTimeout(750);
    expect(await stage.getAttribute("data-camera")).toBe(camera);
    const poses = await takePoses(page);
    expect(poses.length).toBeGreaterThan(0);
    const final = poses.at(-1)!;
    expect(final.clearance).toBeGreaterThan(0);
    expect(
        [
            ...final.camera,
            ...final.target,
            ...final.up,
            ...final.quaternion,
        ].every(Number.isFinite),
    ).toBe(true);
});

test("pause freezes an in-progress surface descent", async ({ page }) => {
    test.setTimeout(180_000);
    const stage = await openExperience(page);
    await page.getByRole("button", { name: "Moon", exact: true }).click();
    await expect
        .poll(
            async () =>
                Number(await stage.getAttribute("data-surface-progress")),
            { timeout: 90000 },
        )
        .toBeGreaterThan(0.1);
    const descent = Number(await stage.getAttribute("data-surface-progress"));
    expect(descent).toBeLessThan(0.98);
    await page.locator("[data-experience-motion]").click();
    await expect(stage).toHaveAttribute("data-state", "paused");
    const position = await stage.getAttribute("data-camera");
    const surface = await stage.getAttribute("data-surface-progress");
    await page.waitForTimeout(1000);
    expect(await stage.getAttribute("data-camera")).toBe(position);
    expect(await stage.getAttribute("data-surface-progress")).toBe(surface);
    await page.locator("[data-experience-motion]").click();
    await expect(stage).toHaveAttribute("data-view", "surface", {
        timeout: 90000,
    });
});

test("a destination selected during a drag wins over queued scrolling", async ({
    page,
}) => {
    test.setTimeout(180_000);
    const stage = await openExperience(page);
    await page.getByRole("button", { name: "Moon", exact: true }).click();
    await expect(stage).toHaveAttribute("data-view", "surface", {
        timeout: 90000,
    });
    const box = await stage.boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error("Experience stage has no bounds");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, {
        steps: 4,
    });
    await expect(stage).toHaveAttribute("data-camera-owner", "manual");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect
        .poll(() => page.evaluate(() => window.scrollY), { timeout: 30000 })
        .toBe(0);
    const mars = page.getByRole("button", { name: "Mars", exact: true });
    await mars.focus();
    await page.keyboard.press("Enter");
    await page.mouse.up();
    await expect(stage).toHaveAttribute("data-world", "mars", {
        timeout: 90000,
    });
    await expect(mars).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(1000);
    await expect(stage).toHaveAttribute("data-world", "mars");
});
