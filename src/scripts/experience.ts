import type * as Three from "three";
import type { ScenePhase } from "../lib/scene-time";
import { waitForSceneClock, refreshSceneClock } from "../lib/scene-clock";
import { createJourneyPlayback } from "../lib/journey-playback";
import { addSatellites } from "./orbital-satellites";
import { addLunarLaunch } from "./lunar-launch";
import {
    loadOutpost,
    attachOutpost,
    OUTPOST_SCALE,
    disposeOutpost,
    outpostCamera,
} from "./planetary-outposts";
import {
    makePlanet,
    disposePlanet,
    worldNames,
    type World,
    type PlanetLighting,
} from "./planet-materials";

const section = document.querySelector<HTMLElement>(".experience-visual");
const stage = section?.querySelector<HTMLElement>("[data-experience-stage]");
const start = section?.querySelector<HTMLButtonElement>(
    "[data-experience-start]",
);
const status = section?.querySelector<HTMLElement>("[data-experience-status]");
const panel = section?.querySelector<HTMLElement>("[data-experience-controls]");
const motionButton = section?.querySelector<HTMLButtonElement>(
    "[data-experience-motion]",
);
const resetButton = section?.querySelector<HTMLButtonElement>(
    "[data-experience-reset]",
);
const current = section?.querySelector<HTMLElement>(
    "[data-experience-current]",
);
const lightingLabel = section?.querySelector<HTMLElement>(
    "[data-experience-lighting]",
);
const page = document.querySelector<HTMLElement>(".experience-page");
const destinationLabel = section?.querySelector<HTMLElement>(
    "[data-experience-destination]",
);
const navigationLabel = section?.querySelector<HTMLElement>(
    "[data-experience-navigation]",
);
const buttons = [
    ...(section?.querySelectorAll<HTMLButtonElement>(
        "[data-experience-world]",
    ) || []),
];
const worldIds = worldNames.map((name) => name.toLowerCase() as World);

if (
    section &&
    stage &&
    start &&
    status &&
    panel &&
    motionButton &&
    resetButton &&
    current
) {
    let cleanup: (() => void) | undefined;
    let generation = 0,
        loading = false,
        pageActive = true;
    const initialize = async () => {
        if (cleanup || loading) return;
        const ticket = ++generation;
        loading = true;
        start.hidden = true;
        let renderer: Three.WebGLRenderer | undefined;
        let firstFrameDrawn = false;
        stage.dataset.ready = "false";
        delete stage.dataset.firstFramePhase;
        try {
            // The first page resolves the local timezone before any planet is
            // requested. Direct links/recovery share the same safe bootstrap.
            const initialClock = await waitForSceneClock();
            stage.dataset.phase = initialClock.phase;
            section.dataset.phase = initialClock.phase;
            if (page) page.dataset.phase = initialClock.phase;
            if (ticket !== generation) return;
            const T = await import("three");
            const { OrbitControls } =
                await import("three/addons/controls/OrbitControls.js");
            if (ticket !== generation) return;
            const render = new T.WebGLRenderer({
                antialias: true,
                alpha: true,
                powerPreference: "high-performance",
            });
            renderer = render;
            render.domElement.style.visibility = "hidden";
            render.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
            render.outputColorSpace = T.SRGBColorSpace;
            render.toneMapping = T.ACESFilmicToneMapping;
            render.toneMappingExposure = 1.05;
            render.setClearColor(0x080f12, 0);
            render.shadowMap.enabled = true;
            render.shadowMap.type = T.PCFShadowMap;
            const scene = new T.Scene();
            const { RoomEnvironment } =
                await import("three/addons/environments/RoomEnvironment.js");
            if (ticket !== generation) {
                render.dispose();
                return;
            }
            const room = new RoomEnvironment();
            const generator = new T.PMREMGenerator(render);
            const reflection = generator.fromScene(room, 0.04);
            scene.environment = reflection.texture;
            scene.environmentIntensity = 0.28;
            room.dispose();
            generator.dispose();
            const camera = new T.PerspectiveCamera(36, 1, 0.05, 160);
            camera.position.set(0, 0.18, 3.45);
            const orbit = new OrbitControls(camera, render.domElement);
            orbit.enableDamping = true;
            orbit.dampingFactor = 0.075;
            orbit.enablePan = false;
            // The page wheel always controls the journey. Deliberate zoom uses +/-.
            orbit.enableZoom = false;
            orbit.rotateSpeed = 0.5;
            orbit.minDistance = 2.2;
            orbit.maxDistance = 14;
            const narrow = matchMedia("(max-width: 800px)");
            const configureTouch = () => {
                render.domElement.style.touchAction = "pan-y";
                orbit.touches.ONE = narrow.matches
                    ? (null as unknown as Three.TOUCH)
                    : T.TOUCH.ROTATE;
                orbit.touches.TWO = T.TOUCH.DOLLY_ROTATE;
            };
            configureTouch();
            const looks: Record<
                ScenePhase,
                {
                    direction: number[];
                    color: number;
                    strength: number;
                    ambient: number;
                    twilight: number;
                }
            > = {
                dawn: {
                    direction: [-4, 1.4, 1.3],
                    color: 0xffdab4,
                    strength: 1.65,
                    ambient: 0.028,
                    twilight: 1,
                },
                day: {
                    direction: [3.5, 2.4, 4],
                    color: 0xfff5e8,
                    strength: 1.6,
                    ambient: 0.025,
                    twilight: 0.2,
                },
                dusk: {
                    direction: [4, 1.1, 0.65],
                    color: 0xffcd9f,
                    strength: 1.65,
                    ambient: 0.023,
                    twilight: 1,
                },
                night: {
                    direction: [-3.5, 1.2, -2.4],
                    color: 0xd6e8ff,
                    strength: 1.5,
                    ambient: 0.022,
                    twilight: 0.35,
                },
            };
            let phase = initialClock.phase;
            const initialLook = looks[phase];
            const sunlight = new T.Vector3()
                .fromArray(initialLook.direction)
                .normalize();
            const lighting: PlanetLighting = {
                sunDirection: { value: sunlight },
                sunColor: { value: new T.Color(initialLook.color) },
                sunStrength: { value: initialLook.strength },
                ambientStrength: { value: initialLook.ambient },
                twilightStrength: { value: initialLook.twilight },
                cloudOffset: { value: 0 },
            };
            const targetDirection = sunlight.clone(),
                targetColor = new T.Color(initialLook.color);
            const refreshPhase = () => {
                phase = refreshSceneClock().phase;
                targetDirection.fromArray(looks[phase].direction).normalize();
                targetColor.setHex(looks[phase].color);
                stage.dataset.phase = phase;
                section.dataset.phase = phase;
                if (page) page.dataset.phase = phase;
                if (lightingLabel)
                    lightingLabel.textContent = `${phase.charAt(0).toUpperCase() + phase.slice(1)} · your local time`;
            };
            refreshPhase();
            const sun = new T.DirectionalLight(0xffedda, 2.6);
            // Other worlds keep their legible three-quarter key light. Earth's
            // layered shaders share the visitor's local-time lighting above.
            sun.position.set(5, 2, 1.8).normalize().multiplyScalar(8);
            sun.castShadow = true;
            sun.shadow.mapSize.set(
                narrow.matches ? 1024 : 2048,
                narrow.matches ? 1024 : 2048,
            );
            Object.assign(sun.shadow.camera, {
                left: -3,
                right: 3,
                top: 3,
                bottom: -3,
            });
            sun.shadow.bias = -0.000008;
            sun.shadow.normalBias = 0.00002;
            scene.add(sun.target);
            scene.add(sun);
            const ambient = new T.AmbientLight(0x8cadd3, 0.055);
            scene.add(ambient);
            const loader = new T.TextureLoader(),
                textures = new Map<string, Promise<Three.Texture>>(),
                owned = new Set<Three.Texture>();
            const planets = new Map<number, Three.Group>(),
                pending = new Map<number, Promise<Three.Group>>();
            let disposed = false;
            const outposts = new Map<number, Three.Group>();
            const outpostRequests = new Map<number, Promise<void>>();
            const outpostFailures = new Set<number>();
            let lunarLaunch: ReturnType<typeof addLunarLaunch>;
            let lunarElapsed = 0;
            const playback = createJourneyPlayback();
            const ensureOutpost = (index: number) => {
                if (index !== 1 && index !== 2) return Promise.resolve();
                let request = outpostRequests.get(index);
                if (!request) {
                    request = loadOutpost(
                        index === 1 ? "moon" : "mars",
                        Math.min(8, render.capabilities.getMaxAnisotropy()),
                    )
                        .then((group) => {
                            if (disposed) {
                                disposeOutpost(group);
                                return;
                            }
                            const globe = planets.get(index);
                            if (globe)
                                attachOutpost(
                                    T,
                                    group,
                                    globe,
                                    index === 1 ? "moon" : "mars",
                                );
                            if (index === 1)
                                lunarLaunch = addLunarLaunch(T, group);
                            outposts.set(index, group);
                            schedule();
                        })
                        .catch(() => {
                            // A surface study is optional: its globe always remains usable.
                            outpostRequests.delete(index);
                            outpostFailures.add(index);
                        });
                    outpostRequests.set(index, request);
                }
                return request;
            };
            const texture = async (name: string, color = true) => {
                let value = textures.get(name);
                if (!value) {
                    value = loader
                        .loadAsync(`/images/trajectory/${name}.webp`)
                        .then((t) => {
                            if (color) t.colorSpace = T.SRGBColorSpace;
                            t.anisotropy = Math.min(
                                8,
                                render.capabilities.getMaxAnisotropy(),
                            );
                            if (disposed) t.dispose();
                            else owned.add(t);
                            return t;
                        })
                        .catch((e) => {
                            textures.delete(name);
                            throw e;
                        });
                    textures.set(name, value);
                }
                return value;
            };
            const small =
                narrow.matches ||
                render.capabilities.maxTextureSize < 8192 ||
                (
                    navigator as Navigator & {
                        connection?: { saveData?: boolean };
                    }
                ).connection?.saveData ||
                ((navigator as Navigator & { deviceMemory?: number })
                    .deviceMemory || 8) <= 4;
            const failed = new Set<number>();
            let satellites: ReturnType<typeof addSatellites> | undefined;
            const ensurePlanet = (index: number) => {
                let value = pending.get(index);
                if (!value) {
                    value = makePlanet(
                        T,
                        worldIds[index],
                        small,
                        texture,
                        lighting,
                    )
                        .then((group) => {
                            if (disposed) {
                                disposePlanet(group);
                                return group;
                            }
                            group.visible = false;
                            planets.set(index, group);
                            const outpost = outposts.get(index);
                            if (outpost)
                                attachOutpost(
                                    T,
                                    outpost,
                                    group,
                                    index === 1 ? "moon" : "mars",
                                );
                            if (index === 0) {
                                satellites = addSatellites(T, group);
                                stage.dataset.satellites = String(
                                    satellites.count,
                                );
                            }
                            scene.add(group);
                            schedule();
                            return group;
                        })
                        .catch((error) => {
                            pending.delete(index);
                            failed.add(index);
                            throw error;
                        });
                    pending.set(index, value);
                }
                return value;
            };
            let seed = 412;
            const random = () => {
                seed = (seed * 16807) % 2147483647;
                return (seed - 1) / 2147483646;
            };
            const starPoints = new Float32Array(1600 * 3),
                starColors = new Float32Array(1600 * 3);
            for (let i = 0; i < starPoints.length; i += 3) {
                const y = random() * 2 - 1,
                    a = random() * Math.PI * 2,
                    r = Math.sqrt(1 - y * y) * 55;
                starPoints[i] = Math.cos(a) * r;
                starPoints[i + 1] = y * 55;
                starPoints[i + 2] = Math.sin(a) * r;
                const light = 0.25 + random() * 0.7;
                starColors[i] = light * 0.82;
                starColors[i + 1] = light * 0.9;
                starColors[i + 2] = light;
            }
            const starsGeo = new T.BufferGeometry();
            starsGeo.setAttribute(
                "position",
                new T.BufferAttribute(starPoints, 3),
            );
            starsGeo.setAttribute(
                "color",
                new T.BufferAttribute(starColors, 3),
            );
            const starsMat = new T.PointsMaterial({
                size: 0.065,
                vertexColors: true,
                transparent: true,
                opacity: 0.8,
                depthWrite: false,
            });
            scene.add(new T.Points(starsGeo, starsMat));
            let frame = 0,
                visible = true,
                paused = false,
                dragging = false,
                target = 0,
                progress = 0,
                manualZoom = 1,
                lastTime = 0,
                lastWorld = -1;
            let surfaceMix = 0,
                surfaceWorld = -1,
                freeLook = false;
            let orbitalDistance = 3.45;
            const approachDirection = new T.Vector3();
            const approachTarget = new T.Vector3();
            let knots: number[] = [];
            const motion = matchMedia("(prefers-reduced-motion: reduce)");
            const entries = [
                ...document.querySelectorAll<HTMLElement>(
                    "[data-journey-step]",
                ),
            ];
            const record = document.querySelector<HTMLElement>("#cv");
            const measure = () => {
                const offset = narrow.matches
                    ? innerHeight * 0.48
                    : innerHeight * 0.36;
                const positions = entries.map((entry) =>
                    Math.max(
                        0,
                        entry.getBoundingClientRect().top + scrollY - offset,
                    ),
                );
                const end = Math.max(
                    innerHeight * 2,
                    (record?.getBoundingClientRect().bottom || 0) +
                        scrollY -
                        innerHeight * 0.7,
                );
                knots = worldIds.map((_, i) => {
                    if (!i) return 0;
                    if (positions.length >= 5)
                        return Math.max(
                            i * 120,
                            positions[
                                Math.round((i * (positions.length - 1)) / 4)
                            ],
                        );
                    return (end * i) / 4;
                });
            };
            const readScroll = () => {
                if (!knots.length || section.dataset.layout === "expanded")
                    return;
                let i = 0;
                while (i < 3 && scrollY >= knots[i + 1]) i++;
                target = Math.min(
                    4,
                    Math.max(
                        0,
                        i +
                            (scrollY - knots[i]) /
                                Math.max(1, knots[i + 1] - knots[i]),
                    ),
                );
                schedule();
            };
            const updateControl = () => {
                const reduced = motion.matches;
                const label = reduced
                    ? "Motion reduced by system"
                    : paused
                      ? "Resume motion"
                      : "Pause motion";
                if (motionButton.textContent !== label)
                    motionButton.textContent = label;
                if (motionButton.disabled !== reduced)
                    motionButton.disabled = reduced;
                motionButton.setAttribute("aria-pressed", String(paused));
                orbit.enableDamping = !reduced && !paused;
            };
            const baseDistance = (world: number) => {
                const radius = world === 4 ? 2.25 : 1.08;
                return Math.max(
                    world === 4 ? 6.3 : 3.35,
                    radius /
                        (Math.tan(T.MathUtils.degToRad(18)) *
                            Math.min(1, camera.aspect)),
                );
            };
            const telemetry = () => {
                stage.dataset.camera = [
                    camera.position.x,
                    camera.position.y,
                    camera.position.z,
                ]
                    .map((n) => n.toFixed(4))
                    .join(",");
                stage.dataset.distance = camera.position
                    .distanceTo(orbit.target)
                    .toFixed(4);
            };
            const setLabel = (index: number) => {
                if (index === lastWorld) return;
                lastWorld = index;
                freeLook = false;
                playback.setWorld(worldIds[index]);
                manualZoom = 1;
                current.textContent = worldNames[index];
                if (lightingLabel) {
                    lightingLabel.style.visibility =
                        index === 0 ? "visible" : "hidden";
                    lightingLabel.setAttribute(
                        "aria-hidden",
                        String(index !== 0),
                    );
                }
                stage.dataset.world = worldIds[index];
                buttons.forEach((button, i) =>
                    button.setAttribute("aria-pressed", String(i === index)),
                );
                entries.forEach((entry, i) =>
                    entry.classList.toggle(
                        "is-current",
                        Math.round(
                            (i * 4) / Math.max(1, entries.length - 1),
                        ) === index,
                    ),
                );
            };
            function schedule() {
                if (!frame && !disposed && visible && !document.hidden)
                    frame = requestAnimationFrame(tick);
            }
            const tick = (time: number) => {
                frame = 0;
                if (disposed || !visible || document.hidden) return;
                const elapsedDelta = Math.min(
                    0.25,
                    (time - (lastTime || time)) / 1000,
                );
                const dt = Math.min(0.05, elapsedDelta);
                lastTime = time;
                updateControl();
                const still = paused || motion.matches;
                const look = looks[phase],
                    blend = still ? 1 : 1 - Math.exp(-dt * 1.8);
                sunlight.lerp(targetDirection, blend).normalize();
                lighting.sunColor.value.lerp(targetColor, blend);
                lighting.sunStrength.value = T.MathUtils.lerp(
                    lighting.sunStrength.value,
                    look.strength,
                    blend,
                );
                lighting.ambientStrength.value = T.MathUtils.lerp(
                    lighting.ambientStrength.value,
                    look.ambient,
                    blend,
                );
                lighting.twilightStrength.value = T.MathUtils.lerp(
                    lighting.twilightStrength.value,
                    look.twilight,
                    blend,
                );
                if (!still)
                    lighting.cloudOffset.value =
                        (lighting.cloudOffset.value + dt * 0.00022) % 1;
                satellites?.update(still ? 0 : elapsedDelta);
                if (still) progress = Math.round(target);
                else if (!dragging)
                    progress += (target - progress) * (1 - Math.exp(-dt * 7));
                if (Math.abs(target - progress) < 0.001 && !still)
                    progress = target;
                let from = Math.min(4, Math.floor(progress)),
                    to = Math.min(4, from + 1);
                const part = progress - from;
                let travel = T.MathUtils.smoothstep(part, 0.38, 1);
                if (still) {
                    from = Math.round(target);
                    to = from;
                    travel = 0;
                }
                for (const group of planets.values()) group.visible = false;
                const first = planets.get(from),
                    second = planets.get(to);
                if (!first && !failed.has(from))
                    void ensurePlanet(from).catch(() => {});
                if (!second && to !== from && !failed.has(to))
                    void ensurePlanet(to).catch(() => {});
                // Both planets occupy one continuous 3D scene during the pullback.
                const ready =
                    first && (to === from || second || travel < 0.002);
                if (ready) {
                    first.visible = true;
                    first.position.set(
                        -3.6 * travel,
                        -0.12 * Math.sin(travel * Math.PI),
                        -1.5 * travel,
                    );
                    if (to !== from && second) {
                        second.visible = travel > 0.002;
                        second.position.set(
                            3.6 * (1 - travel),
                            0.12 * Math.sin(travel * Math.PI),
                            -1.5 * (1 - travel),
                        );
                    }
                    const distance =
                        T.MathUtils.lerp(
                            baseDistance(from),
                            baseDistance(to),
                            travel,
                        ) +
                        Math.sin(travel * Math.PI) * 3.8;
                    const direction = camera.position
                        .clone()
                        .sub(orbit.target)
                        .normalize();
                    orbitalDistance = distance * manualZoom;
                    if (!freeLook && surfaceMix < 0.001)
                        camera.position
                            .copy(orbit.target)
                            .addScaledVector(direction, orbitalDistance);
                    setLabel(travel > 0.5 ? to : from);
                    status.textContent = "";
                } else {
                    const retained = planets.get(lastWorld);
                    if (retained) {
                        retained.visible = true;
                        retained.position.set(0, 0, 0);
                    }
                    if (!retained)
                        status.textContent = "Loading the orbital view…";
                    const unavailable = !first ? from : to;
                    if (failed.has(unavailable))
                        status.textContent = `${worldNames[unavailable]} could not load. Select it below to retry.`;
                }
                // The base is a child of its planet. Only the camera moves:
                // the globe and curved local ground remain opaque throughout.
                const near = Math.round(progress);
                if (
                    (near === 1 || near === 2) &&
                    !outposts.has(near) &&
                    !outpostFailures.has(near)
                )
                    void ensureOutpost(near);
                const surfaceReady = outposts.has(near) && planets.has(near);
                const desiredSurface = surfaceReady
                    ? 1 -
                      T.MathUtils.smoothstep(
                          Math.abs(progress - near),
                          0.04,
                          0.24,
                      )
                    : 0;
                if (desiredSurface > 0 && surfaceWorld !== near) {
                    surfaceWorld = near;
                    approachDirection
                        .copy(camera.position)
                        .sub(orbit.target)
                        .normalize();
                    approachTarget.set(0, 0, 0);
                }
                surfaceMix = still
                    ? desiredSurface
                    : T.MathUtils.damp(
                          surfaceMix,
                          desiredSurface,
                          desiredSurface > surfaceMix ? 1.35 : 5,
                          elapsedDelta,
                      );
                if (surfaceMix < 0.001) surfaceMix = 0;
                if (surfaceMix > 0.9995) surfaceMix = 1;
                playback.setWorld(worldIds[Math.max(0, lastWorld)]);
                playback.setActive(surfaceMix >= 0.98 && desiredSurface > 0.9);
                playback.setVisibility(visible && !document.hidden);
                playback.setPaused(paused);
                playback.setReducedMotion(motion.matches);
                playback.setManualOrbit(freeLook);
                const play = playback.tick(time);
                stage.dataset.journeyTime = play.elapsed.toFixed(3);
                stage.dataset.guidedTime = play.guidedElapsed.toFixed(3);
                stage.dataset.surfaceProgress = surfaceMix.toFixed(4);
                stage.dataset.surface = String(surfaceMix > 0.02);
                section.dataset.surface = stage.dataset.surface;
                const outpost = outposts.get(surfaceWorld);
                let landmark = "";
                if (outpost && surfaceMix > 0) {
                    const pose = outpostCamera(
                        T,
                        outpost,
                        surfaceWorld === 1 ? "moon" : "mars",
                        play.guidedElapsed,
                        lunarLaunch?.positionAt,
                    );
                    landmark = pose.landmark;
                    if (!freeLook && !dragging) {
                        const globe = planets.get(surfaceWorld)!;
                        const origin = approachTarget
                            .clone()
                            .addScaledVector(
                                approachDirection,
                                orbitalDistance,
                            );
                        const fromDirection = origin
                            .clone()
                            .sub(globe.position);
                        const toDirection = pose.position
                            .clone()
                            .sub(globe.position);
                        const radius = Math.exp(
                            T.MathUtils.lerp(
                                Math.log(fromDirection.length()),
                                Math.log(toDirection.length()),
                                surfaceMix,
                            ),
                        );
                        fromDirection
                            .normalize()
                            .lerp(
                                toDirection.normalize(),
                                T.MathUtils.smoothstep(surfaceMix, 0, 0.5),
                            )
                            .normalize();
                        const desiredPosition = globe.position
                            .clone()
                            .addScaledVector(fromDirection, radius);
                        const desiredTarget = approachTarget
                            .clone()
                            .lerp(
                                pose.target,
                                T.MathUtils.smoothstep(surfaceMix, 0, 0.45),
                            );
                        // This final ease also absorbs a manual -> guided replay.
                        const follow = still
                            ? 1
                            : 1 - Math.exp(-elapsedDelta * 5);
                        camera.position.lerp(desiredPosition, follow);
                        orbit.target.lerp(desiredTarget, follow);
                    }
                    const surfaceUp = new T.Vector3(0, 1, 0).applyQuaternion(
                        outpost.getWorldQuaternion(new T.Quaternion()),
                    );
                    camera.up
                        .set(0, 1, 0)
                        .lerp(surfaceUp, surfaceMix)
                        .normalize();
                    const anchor = outpost.getWorldPosition(new T.Vector3());
                    sun.target.position.copy(anchor);
                    sun.position
                        .copy(anchor)
                        .add(new T.Vector3(0.7, 1.1, 0.65));
                    const shadowSize = 0.22;
                    Object.assign(sun.shadow.camera, {
                        left: -shadowSize,
                        right: shadowSize,
                        top: shadowSize,
                        bottom: -shadowSize,
                        near: 0.05,
                        far: 3,
                    });
                    sun.shadow.camera.updateProjectionMatrix();
                    stage.dataset.surfaceAnchor = anchor
                        .toArray()
                        .map((n) => n.toFixed(5))
                        .join(",");
                    stage.dataset.settlementAttached = String(
                        outpost.parent === planets.get(surfaceWorld),
                    );
                } else if (!freeLook) {
                    camera.up.set(0, 1, 0);
                    orbit.target.lerp(
                        new T.Vector3(),
                        still ? 1 : 1 - Math.exp(-dt * 5),
                    );
                    sun.target.position.set(0, 0, 0);
                    if (lastWorld === 0)
                        sun.position.copy(sunlight).multiplyScalar(8);
                    else
                        sun.position
                            .set(5, 2, 1.8)
                            .normalize()
                            .multiplyScalar(8);
                    Object.assign(sun.shadow.camera, {
                        left: -3,
                        right: 3,
                        top: 3,
                        bottom: -3,
                        near: 0.5,
                        far: 20,
                    });
                    sun.shadow.camera.updateProjectionMatrix();
                }
                if (lunarLaunch) {
                    const active = lastWorld === 1 && surfaceMix >= 0.98;
                    if (lastWorld === 1) lunarElapsed = play.elapsed;
                    const launch = lunarLaunch.update(lunarElapsed);
                    stage.dataset.launchState = active
                        ? still
                            ? "paused"
                            : "running"
                        : "inactive";
                    stage.dataset.launchPhase = launch.phase;
                    stage.dataset.launchCycle = String(launch.cycle);
                    stage.dataset.launchPosition = launch.position
                        .toArray()
                        .map((n) => n.toFixed(3))
                        .join(",");
                }
                ambient.intensity = 0.055 + surfaceMix * 0.24;
                sun.intensity = 2.6 - surfaceMix * 0.2;
                orbit.minDistance = surfaceMix > 0.5 ? 22 * OUTPOST_SCALE : 2.2;
                orbit.maxPolarAngle = Math.PI;
                stage.dataset.view = surfaceMix > 0.98 ? "surface" : "orbit";
                section.dataset.view = stage.dataset.view;
                stage.dataset.navigation = freeLook ? "manual" : "guided";
                if (navigationLabel)
                    navigationLabel.textContent = freeLook
                        ? "Free exploration"
                        : surfaceMix > 0.98
                          ? "Guided exploration"
                          : "Scroll to travel";
                if (destinationLabel)
                    destinationLabel.textContent =
                        surfaceMix > 0.98
                            ? landmark
                            : lastWorld === 0
                              ? "Earth · Our starting point"
                              : `${worldNames[Math.max(0, lastWorld)]} · ${surfaceMix > 0.1 ? "Descending to the settlement" : "Orbital approach"}`;
                orbit.autoRotate =
                    !still &&
                    !dragging &&
                    !freeLook &&
                    surfaceMix < 0.01 &&
                    Math.abs(target - progress) < 0.01;
                orbit.enableDamping = !still && freeLook;
                orbit.autoRotateSpeed = 0.12;
                orbit.update(dt);
                if (surfaceMix > 0.5) {
                    // Keep free exploration above the curved surface.
                    const globe = planets.get(surfaceWorld);
                    if (globe) {
                        const offset = camera.position
                            .clone()
                            .sub(globe.position);
                        if (offset.length() < 1.003)
                            camera.position
                                .copy(globe.position)
                                .add(offset.setLength(1.003));
                    }
                }
                // Preserve depth precision in orbit. A surface-sized near
                // plane makes Earth's closely spaced cloud/surface layers flicker.
                const nearPlane = T.MathUtils.clamp(
                    camera.position.distanceTo(orbit.target) * 0.02,
                    0.00008,
                    0.05,
                );
                if (Math.abs(camera.near - nearPlane) > 0.000001) {
                    camera.near = nearPlane;
                    camera.updateProjectionMatrix();
                }
                stage.dataset.nearPlane = camera.near.toFixed(6);
                telemetry();
                render.render(scene, camera);
                if (!firstFrameDrawn && ready) {
                    firstFrameDrawn = true;
                    render.domElement.style.visibility = "visible";
                    stage.dataset.firstFramePhase = phase;
                    stage.dataset.ready = "true";
                }
                stage.dataset.progress = progress.toFixed(4);
                stage.dataset.transition = travel.toFixed(4);
                stage.dataset.state = still ? "paused" : "running";
                if (!still) schedule();
            };
            const resize = () => {
                const w = stage.clientWidth,
                    h = stage.clientHeight;
                if (!w || !h) return;
                render.setSize(w, h, false);
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
                measure();
                // A size/font/layout change must not move the selected world.
                // Only actual page scrolling updates the journey destination.
                schedule();
            };
            const syncMotion = () => {
                lastTime = 0;
                playback.setPaused(paused);
                playback.setReducedMotion(motion.matches);
                updateControl();
                schedule();
            };
            const toggleMotion = () => {
                paused = !paused;
                syncMotion();
            };
            const reset = () => {
                playback.setManualOrbit(true);
                playback.setManualOrbit(false);
                freeLook = false;
                manualZoom = 1;
                if (surfaceMix < 0.01) {
                    camera.position.set(
                        0,
                        0.18,
                        baseDistance(Math.max(0, lastWorld)),
                    );
                    orbit.target.set(0, 0, 0);
                }
                schedule();
            };
            const key = (event: KeyboardEvent) => {
                if (event.key === "Home") {
                    event.preventDefault();
                    reset();
                    return;
                }
                const s = new T.Spherical().setFromVector3(
                    camera.position.clone().sub(orbit.target),
                );
                if (event.key === "ArrowLeft") s.theta -= 0.16;
                else if (event.key === "ArrowRight") s.theta += 0.16;
                else if (event.key === "ArrowUp")
                    s.phi = Math.max(0.1, s.phi - 0.16);
                else if (event.key === "ArrowDown")
                    s.phi = Math.min(Math.PI - 0.1, s.phi + 0.16);
                else if (event.key === "+" || event.key === "=") {
                    manualZoom = Math.max(0.7, manualZoom * 0.85);
                    s.radius = Math.max(orbit.minDistance, s.radius * 0.85);
                } else if (event.key === "-") {
                    manualZoom = Math.min(2.2, manualZoom / 0.85);
                    s.radius = Math.min(14, s.radius / 0.85);
                } else return;
                freeLook = true;
                event.preventDefault();
                camera.position.setFromSpherical(s).add(orbit.target);
                orbit.update();
                schedule();
            };
            const zoomButtons = [
                ...section.querySelectorAll<HTMLButtonElement>(
                    "[data-experience-zoom]",
                ),
            ];
            const zoomHandlers = zoomButtons.map((button) => {
                const handler = () =>
                    key(
                        new KeyboardEvent("keydown", {
                            key: button.dataset.experienceZoom,
                            cancelable: true,
                        }),
                    );
                button.addEventListener("click", handler);
                return handler;
            });
            const selections = buttons.map((button, i) => {
                const select = () => {
                    failed.delete(i);
                    outpostFailures.delete(i);
                    void ensurePlanet(i).catch(() => {});
                    void ensureOutpost(i);
                    window.scrollTo({
                        top: knots[i] || 0,
                        behavior: "instant",
                    });
                    target = i;
                    schedule();
                };
                button.addEventListener("click", select);
                return select;
            });
            const beginDrag = () => {
                dragging = true;
                freeLook = true;
            };
            const endDrag = () => {
                dragging = false;
                schedule();
            };
            orbit.addEventListener("start", beginDrag);
            orbit.addEventListener("end", endDrag);
            const orbitChanged = () => {
                telemetry();
                if (dragging || freeLook) schedule();
            };
            orbit.addEventListener("change", orbitChanged);
            const observer = new IntersectionObserver((items) => {
                lastTime = 0;
                visible = items[0]?.isIntersecting ?? false;
                playback.setVisibility(visible && !document.hidden);
                if (!visible && frame) {
                    cancelAnimationFrame(frame);
                    frame = 0;
                } else schedule();
            });
            observer.observe(stage);
            const sizes = new ResizeObserver(resize);
            sizes.observe(stage);
            if (record) sizes.observe(record);
            const visibility = () => {
                lastTime = 0;
                playback.setVisibility(visible && !document.hidden);
                if (document.hidden && frame) {
                    cancelAnimationFrame(frame);
                    frame = 0;
                } else {
                    refreshPhase();
                    schedule();
                }
            };
            const phaseTimer = setInterval(() => {
                if (!document.hidden && refreshSceneClock().phase !== phase) {
                    refreshPhase();
                    schedule();
                }
            }, 60000);
            let lastReduced = motion.matches;
            const preferenceTimer = setInterval(() => {
                if (!document.hidden && lastReduced !== motion.matches) {
                    lastReduced = motion.matches;
                    syncMotion();
                }
            }, 500);
            const lost = (event: Event) => {
                event.preventDefault();
                cleanup?.();
                cleanup = undefined;
                status.textContent =
                    "The visual is unavailable. Your experience record remains readable.";
                start.textContent = "Try again";
                start.hidden = false;
            };
            window.addEventListener("scroll", readScroll, { passive: true });
            window.addEventListener("resize", resize);
            document.addEventListener("visibilitychange", visibility);
            motion.addEventListener("change", syncMotion);
            narrow.addEventListener("change", configureTouch);
            motionButton.addEventListener("click", toggleMotion);
            resetButton.addEventListener("click", reset);
            stage.addEventListener("keydown", key);
            render.domElement.addEventListener("webglcontextlost", lost);
            let preloadTimer = 0;
            cleanup = () => {
                disposed = true;
                cancelAnimationFrame(frame);
                clearInterval(preferenceTimer);
                clearInterval(phaseTimer);
                clearTimeout(preloadTimer);
                observer.disconnect();
                sizes.disconnect();
                window.removeEventListener("scroll", readScroll);
                window.removeEventListener("resize", resize);
                document.removeEventListener("visibilitychange", visibility);
                motion.removeEventListener("change", syncMotion);
                narrow.removeEventListener("change", configureTouch);
                motionButton.removeEventListener("click", toggleMotion);
                resetButton.removeEventListener("click", reset);
                stage.removeEventListener("keydown", key);
                render.domElement.removeEventListener("webglcontextlost", lost);
                buttons.forEach((button, i) =>
                    button.removeEventListener("click", selections[i]),
                );
                zoomButtons.forEach((button, i) =>
                    button.removeEventListener("click", zoomHandlers[i]),
                );
                orbit.dispose();
                outposts.forEach((group) => {
                    group.removeFromParent();
                    disposeOutpost(group);
                });
                satellites?.dispose();
                planets.forEach(disposePlanet);
                owned.forEach((t) => t.dispose());
                starsGeo.dispose();
                starsMat.dispose();
                sun.shadow.dispose();
                reflection.dispose();
                render.dispose();
                render.domElement.remove();
                stage.hidden = true;
                panel.hidden = true;
            };
            stage.appendChild(render.domElement);
            stage.hidden = false;
            panel.hidden = false;
            resize();
            readScroll();
            await ensurePlanet(0);
            if (disposed) return;
            start.hidden = true;
            status.textContent = "";
            schedule();
            // Warm the remaining worlds after the first frame, so scrolling never swaps a blank globe.
            preloadTimer = window.setTimeout(() => {
                void (async () => {
                    for (let i = 1; i < worldIds.length && !disposed; i++)
                        await ensurePlanet(i).catch(() => {});
                })();
            }, 350);
        } catch {
            cleanup?.();
            cleanup = undefined;
            renderer?.dispose();
            stage.hidden = true;
            panel.hidden = true;
            start.hidden = false;
            start.textContent = "Try again";
            status.textContent =
                "The visual could not be loaded. The experience record is available below.";
        } finally {
            loading = false;
            if (ticket !== generation && pageActive) void initialize();
        }
    };
    start.addEventListener("click", () => void initialize());
    void initialize();
    window.addEventListener("pagehide", () => {
        pageActive = false;
        generation++;
        cleanup?.();
        cleanup = undefined;
    });
    window.addEventListener("pageshow", (event) => {
        pageActive = true;
        if (event.persisted) void initialize();
    });
}
