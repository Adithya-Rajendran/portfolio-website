import type * as Three from "three";
import type { ScenePhase } from "../lib/scene-time";
import { waitForSceneClock, refreshSceneClock } from "../lib/scene-clock";
import { createJourneyPlayback } from "../lib/journey-playback";
import { createScrollJourney } from "../lib/scroll-journey";
import { isSoftwareRenderer, rendererName } from "../lib/renderer-kind";
import { setupExperienceLayout } from "./experience-layout";
import { createExperienceNavigation } from "./experience-navigation";
import {
    applySceneCameraKey,
    bindCameraTools,
    configureSceneOrbit,
    isCameraShortcut,
    zoomSceneCamera,
} from "./scene-camera-controls";
import {
    arcPosition,
    createExperienceCamera,
    type CameraPose,
    TERRAIN_RADIUS,
} from "./experience-camera";
import { addSatellites } from "./orbital-satellites";
import { addLunarLaunch } from "./lunar-launch";
import { addSettlementTraffic } from "./settlement-traffic";
import { makeSettlementCaptions } from "./settlement-captions";
import {
    loadOutpost,
    attachOutpost,
    disposeOutpost,
    outpostCamera,
    outpostTextures,
    settlementAirOf,
    settlementMayShow,
    settlementParts,
    SETTLEMENT_FLOOR,
} from "./planetary-outposts";
import {
    makePlanet,
    disposePlanet,
    worldNames,
    type World,
    type PlanetLighting,
} from "./planet-materials";

/** Radians a second: a ring habitat turns once in about eighteen seconds. */
const SPIN_RATE = 0.35;

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
const replayButton = section?.querySelector<HTMLButtonElement>(
    "[data-experience-replay]",
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
    replayButton &&
    current
) {
    let layout = setupExperienceLayout(section);
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
        let disposeInput: (() => void) | undefined;
        let firstFrameDrawn = false;
        stage.dataset.ready = "false";
        delete stage.dataset.firstFramePhase;
        try {
            // The modules do not depend on the clock, so fetch them while it
            // resolves instead of one after another.
            const modules = Promise.all([
                import("three"),
                import("three/addons/controls/OrbitControls.js"),
                import("three/addons/environments/RoomEnvironment.js"),
            ]);
            // A clock failure leaves this unawaited; any import failure is
            // still thrown by the await below.
            modules.catch(() => {});
            // The first page resolves the local timezone before any planet is
            // requested. Direct links/recovery share the same safe bootstrap.
            const initialClock = await waitForSceneClock();
            stage.dataset.phase = initialClock.phase;
            section.dataset.phase = initialClock.phase;
            if (page) page.dataset.phase = initialClock.phase;
            if (ticket !== generation) return;
            const [T, { OrbitControls }, { RoomEnvironment }] = await modules;
            if (ticket !== generation) return;
            // A renderer that draws on the processor (a test machine, a
            // remote desktop) gets the lighter scene: every sample of every
            // pixel is its own work there.
            const probe = document.createElement("canvas").getContext("webgl2");
            const software = probe
                ? isSoftwareRenderer(rendererName(probe))
                : false;
            probe?.getExtension("WEBGL_lose_context")?.loseContext();
            const render = new T.WebGLRenderer({
                antialias: !software,
                alpha: true,
                powerPreference: "high-performance",
            });
            renderer = render;
            const gl = render.getContext() as WebGL2RenderingContext;
            render.domElement.style.visibility = "hidden";
            render.setPixelRatio(
                software ? 1 : Math.min(devicePixelRatio || 1, 2),
            );
            render.outputColorSpace = T.SRGBColorSpace;
            render.toneMapping = T.ACESFilmicToneMapping;
            render.toneMappingExposure = 1.05;
            render.setClearColor(0x080f12, 0);
            render.shadowMap.enabled = true;
            render.shadowMap.type = T.PCFShadowMap;
            const scene = new T.Scene();
            const room = new RoomEnvironment();
            const generator = new T.PMREMGenerator(render);
            const reflection = generator.fromScene(room, 0.04);
            scene.environment = reflection.texture;
            scene.environmentIntensity = 0.28;
            room.dispose();
            generator.dispose();
            const camera = new T.PerspectiveCamera(36, 1, 0.05, 160);
            camera.position.set(0, 0.18, 3.45);
            const orbit = new OrbitControls(camera.clone(), stage);
            disposeInput = () => orbit.dispose();
            const rig = createExperienceCamera(T, camera, orbit);
            configureSceneOrbit(orbit);
            orbit.enableDamping = true;
            orbit.dampingFactor = 0.075;
            let exploring = false;
            const narrow = matchMedia("(max-width: 800px)");
            const configureInput = () => {
                orbit.enablePan = exploring;
                orbit.enableZoom = exploring;
                stage.style.touchAction = exploring ? "none" : "pan-y";
                orbit.touches.ONE =
                    exploring || !narrow.matches ? T.TOUCH.ROTATE : null;
                orbit.touches.TWO = exploring
                    ? T.TOUCH.DOLLY_PAN
                    : T.TOUCH.DOLLY_ROTATE;
            };
            configureInput();
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
            // A settlement's long shadows are read from one map over the
            // whole town, so a desktop gets a finer one.
            const shadowTexels =
                software || narrow.matches
                    ? 1024
                    : render.capabilities.maxTextureSize >= 8192
                      ? 4096
                      : 2048;
            sun.shadow.mapSize.set(shadowTexels, shadowTexels);
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
            const SURFACE_LIGHT = {
                // With no air, nothing but the soil lights a lunar shadow:
                // the sun is everything and shade is close to black.
                1: {
                    sun: new T.Color(0xfff6ea),
                    strength: 3.7,
                    fill: new T.Color(0xb9bdc6),
                    ambient: 0.04,
                },
                // Mars's sun comes through dust, warm, and its sky fills
                // the shade with what the dust did not keep.
                2: {
                    sun: new T.Color(1, 0.87, 0.72),
                    strength: 3.6,
                    fill: new T.Color(0xa3a8c0),
                    ambient: 0.3,
                },
            };
            const loader = new T.TextureLoader(),
                textures = new Map<string, Promise<Three.Texture>>(),
                owned = new Set<Three.Texture>();
            // Large maps decode off the main thread. The bitmap is flipped when
            // created because three ignores texture.flipY for bitmaps, and
            // colour-space conversion is off, so the pixels match the plain
            // image path. Without createImageBitmap, TextureLoader runs.
            const decode = async (name: string) => {
                const url = `/images/trajectory/${name}.webp`;
                if (
                    typeof createImageBitmap !== "function" ||
                    !/-(2k|4k|8k)$/.test(name)
                )
                    return loader.loadAsync(url);
                // A failed request is reported as it is: asking again through
                // the image path would only repeat it.
                const response = await fetch(url);
                if (!response.ok)
                    throw new Error(`${url} answered ${response.status}`);
                const blob = await response.blob();
                let bitmap: ImageBitmap;
                try {
                    bitmap = await createImageBitmap(blob, {
                        imageOrientation: "flipY",
                        premultiplyAlpha: "none",
                        colorSpaceConversion: "none",
                    });
                } catch {
                    // Only a failed decode takes the plain image path, which
                    // the browser answers from the response it just stored.
                    return loader.loadAsync(url);
                }
                const t = new T.Texture(bitmap);
                t.flipY = false;
                t.needsUpdate = true;
                // The GPU copy is all that is used afterwards, so free the
                // decoded pixels once uploaded or disposed.
                t.onUpdate = () => bitmap.close();
                t.addEventListener("dispose", () => bitmap.close());
                return t;
            };
            const planets = new Map<number, Three.Group>(),
                pending = new Map<number, Promise<Three.Group>>();
            let disposed = false;
            const outposts = new Map<number, Three.Group>();
            const outpostRequests = new Map<number, Promise<void>>();
            const outpostFailures = new Set<number>();
            let lunarLaunch: ReturnType<typeof addLunarLaunch>;
            let lunarElapsed = 0;
            const traffic = new Map<
                number,
                ReturnType<typeof addSettlementTraffic>
            >();
            // The names of what stands in a settlement, hung over the picture.
            const captions = makeSettlementCaptions(
                T,
                stage.parentElement ?? stage,
            );
            const pictureSize = new T.Vector2();
            // Home, standing over the horizon the lunar driver points at. It
            // is drawn only from the Moon's surface, where the journey's own
            // Earth is out of the picture, and larger than life.
            let earthrise: Three.Group | undefined;
            const EARTHRISE = {
                toward: new T.Vector3(0.37, 0.156, -0.916).normalize(),
                away: 60,
                radius: 60 * Math.tan(T.MathUtils.degToRad(2.3)),
            };
            const earthriseToward = new T.Vector3(),
                earthriseTurn = new T.Quaternion(),
                sunToward = new T.Vector3();
            const playback = createJourneyPlayback();
            // Link shaders ahead of the first draw. Late arrivals only start
            // compiling; nothing waits for them.
            const warm = (object: Three.Object3D) => {
                if (!disposed)
                    void render
                        .compileAsync(object, camera, scene)
                        .catch(() => {});
            };
            // The first globe is awaited, so the first visible frame does not
            // stall on linking. The wait is bounded: a lost context never
            // completes it, and a retry must not be left waiting.
            const prepare = async (objects: Three.Object3D[]) => {
                let timer = 0;
                try {
                    await Promise.race([
                        Promise.all(
                            objects.map((object) =>
                                render.compileAsync(object, camera, scene),
                            ),
                        ),
                        new Promise<void>((resolve) => {
                            timer = window.setTimeout(resolve, 3000);
                        }),
                    ]);
                } catch {
                    // Programs are then linked by the first draw, as before.
                } finally {
                    clearTimeout(timer);
                }
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
            const ensureOutpost = (index: number) => {
                if (index !== 1 && index !== 2) return Promise.resolve();
                let request = outpostRequests.get(index);
                if (!request) {
                    request = loadOutpost(
                        index === 1 ? "moon" : "mars",
                        render,
                        {
                            anisotropy: software
                                ? 1
                                : Math.min(
                                      8,
                                      render.capabilities.getMaxAnisotropy(),
                                  ),
                            lite: small || software,
                        },
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
                            if (index === 1) {
                                lunarLaunch = addLunarLaunch(T, group);
                                Promise.all([
                                    texture("earth-surface-v2-2k"),
                                    texture("earth-clouds-v2-2k", false, true),
                                ])
                                    .then(([map, clouds]) => {
                                        if (disposed || earthrise) return;
                                        const shape = new T.SphereGeometry(
                                            1,
                                            48,
                                            24,
                                        );
                                        const land = new T.MeshStandardMaterial(
                                            {
                                                map,
                                                color: 0xb4bcc6,
                                                roughness: 1,
                                                metalness: 0,
                                                envMapIntensity: 0,
                                            },
                                        );
                                        // Weather over it: what makes it home
                                        // and not a map of it.
                                        land.onBeforeCompile = (shader) => {
                                            shader.uniforms.homeClouds = {
                                                value: clouds,
                                            };
                                            shader.fragmentShader =
                                                shader.fragmentShader
                                                    .replace(
                                                        "#include <common>",
                                                        `#include <common>
                                                        uniform sampler2D homeClouds;`,
                                                    )
                                                    .replace(
                                                        "#include <map_fragment>",
                                                        `#include <map_fragment>
                                                        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.86), smoothstep(.12, .7, texture2D(homeClouds, vMapUv).r) * .92);`,
                                                    );
                                        };
                                        land.customProgramCacheKey = () =>
                                            "earth-in-the-lunar-sky";
                                        const globe = new T.Mesh(shape, land);
                                        // Its air, as a thin blue rim.
                                        const air = new T.Mesh(
                                            shape,
                                            new T.MeshBasicMaterial({
                                                color: 0x4f8fe0,
                                                transparent: true,
                                                opacity: 0.2,
                                                blending: T.AdditiveBlending,
                                                side: T.BackSide,
                                                depthWrite: false,
                                                toneMapped: false,
                                            }),
                                        );
                                        air.scale.setScalar(1.035);
                                        globe.rotation.set(0.42, 2.3, 0.2);
                                        earthrise = new T.Group();
                                        earthrise.name =
                                            "Earth in the lunar sky";
                                        earthrise.add(globe, air);
                                        earthrise.visible = false;
                                        scene.add(earthrise);
                                    })
                                    .catch(() => {
                                        // The sky is complete without it.
                                    });
                            }
                            // A world with air has a sky of its own.
                            const sky = settlementAirOf(group)?.sky;
                            if (sky) scene.add(sky);
                            traffic.set(
                                index,
                                addSettlementTraffic(
                                    T,
                                    group,
                                    index === 1 ? "moon" : "mars",
                                ),
                            );
                            outposts.set(index, group);
                            // Start linking its programs and uploading its maps
                            // now, long before the descent can show it.
                            warm(group);
                            outpostTextures(group).forEach((t) => {
                                try {
                                    render.initTexture(t);
                                } catch {
                                    // Uploaded on first draw instead.
                                }
                            });
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
            const texture = async (
                name: string,
                color = true,
                single = false,
            ) => {
                let value = textures.get(name);
                if (!value) {
                    value = decode(name)
                        .then((t) => {
                            if (color) t.colorSpace = T.SRGBColorSpace;
                            // Linear masks that the shader reads as .r only.
                            if (single) t.format = T.RedFormat;
                            // Sampler state is fixed at the first upload, so
                            // it is set here, before initTexture below.
                            if (name.startsWith("earth-clouds"))
                                t.wrapS = T.RepeatWrapping;
                            t.anisotropy = Math.min(
                                8,
                                render.capabilities.getMaxAnisotropy(),
                            );
                            if (disposed) t.dispose();
                            else {
                                owned.add(t);
                                // Upload now, not inside the first frame that
                                // draws it. A failed upload retries on draw.
                                try {
                                    render.initTexture(t);
                                } catch {
                                    // Nothing to undo.
                                }
                            }
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
                        .then(async (group) => {
                            if (disposed) {
                                disposePlanet(group);
                                return group;
                            }
                            group.visible = false;
                            if (index === 0) {
                                satellites = addSatellites(T, group);
                                stage.dataset.satellites = String(
                                    satellites.count,
                                );
                            }
                            // Link this globe's programs before it joins the
                            // scene; the first one also covers the stars.
                            await prepare(
                                index === 0 ? [group, stars] : [group],
                            );
                            if (disposed) {
                                disposePlanet(group);
                                return group;
                            }
                            // Nothing awaits between here and planets.set, so a
                            // settlement arriving meanwhile is attached by
                            // exactly one of the two sides.
                            planets.set(index, group);
                            const outpost = outposts.get(index);
                            if (outpost)
                                attachOutpost(
                                    T,
                                    outpost,
                                    group,
                                    index === 1 ? "moon" : "mars",
                                );
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
            const stars = new T.Points(starsGeo, starsMat);
            // Before a world's sky, which is drawn over them.
            stars.renderOrder = -200;
            scene.add(stars);
            let frame = 0,
                visible = true,
                paused = false,
                dragging = false,
                target = 0,
                progress = 0,
                lastTime = 0,
                lastWorld = -1;
            let surfaceMix = 0,
                surfaceWorld = -1,
                freeLook = false;
            let renderFence: WebGLSync | null = null;
            let orbitalDistance = 3.45;
            const worldUp = new T.Vector3(0, 1, 0);
            const origin = new T.Vector3();
            // Reused every frame instead of allocating.
            const homeDirection = new T.Vector3(0, 0.18, 3.45).normalize();
            const goal: CameraPose = {
                position: new T.Vector3(),
                target: new T.Vector3(),
                up: new T.Vector3(),
            };
            const anchor = new T.Vector3(),
                surfaceUp = new T.Vector3(),
                worldQuaternion = new T.Quaternion(),
                toCamera = new T.Vector3(),
                settlementNormal = new T.Vector3(),
                // The sun a settlement stands under is the one its globe
                // is seen under from orbit, so nothing shifts on the way down.
                sunOffset = new T.Vector3(5, 2, 1.8)
                    .normalize()
                    .multiplyScalar(1.4),
                orbitSun = new T.Color(0xffedda),
                orbitFill = new T.Color(0x8cadd3),
                visibleGlobes: Three.Group[] = [];
            let shadowFrame = "";
            // Writing an unchanged value still queues DOM work.
            const put = (element: HTMLElement, key: string, value: string) => {
                if (element.dataset[key] !== value)
                    element.dataset[key] = value;
            };
            const say = (element: HTMLElement, text: string) => {
                if (element.textContent !== text) element.textContent = text;
            };
            const triple = (x: number, y: number, z: number, digits: number) =>
                `${x.toFixed(digits)},${y.toFixed(digits)},${z.toFixed(digits)}`;
            const orbitDirection = camera.position.clone().normalize();
            const approachDirection = orbitDirection.clone();
            let departure: { pose: CameraPose; mix: number } | undefined;
            let returnTime = 0;
            let pendingTravel: number | undefined;
            let selectionScroll: number | undefined;
            let centeredWorld: number | undefined;
            let navigationDirty = false;
            const scrollJourney = createScrollJourney();
            let knots: number[] = [];
            const motion = matchMedia("(prefers-reduced-motion: reduce)");
            const entries = [
                ...document.querySelectorAll<HTMLElement>(
                    "[data-journey-step]",
                ),
            ];
            const navigation = createExperienceNavigation(section, worldIds);
            const record = document.querySelector<HTMLElement>("#cv");
            const measure = () => {
                knots = worldIds.map((_, i) =>
                    i ? navigation.positionFor(i, narrow.matches) : 0,
                );
                for (let i = 1; i < knots.length; i++)
                    knots[i] = Math.max(knots[i - 1] + 1, knots[i]);
            };
            const alignSelection = () => {
                if (centeredWorld === undefined) return;
                const top = navigation.positionFor(
                    centeredWorld,
                    narrow.matches,
                );
                if (Math.abs(top - scrollY) <= 1) return;
                window.scrollTo({ top, behavior: "instant" });
                selectionScroll = scrollY;
            };
            const releaseAlignment = () => {
                centeredWorld = undefined;
                selectionScroll = undefined;
            };
            const windowKey = (event: KeyboardEvent) => {
                if (!isCameraShortcut(event)) return;
                if (exploring && event.key === "Escape") {
                    event.preventDefault();
                    exitExploration();
                    return;
                }
                if (
                    [
                        "ArrowDown",
                        "ArrowUp",
                        "PageDown",
                        "PageUp",
                        "Home",
                        "End",
                        " ",
                    ].includes(event.key)
                )
                    releaseAlignment();
            };
            const resumeGuide = () => {
                if (freeLook) {
                    orbitDirection.copy(camera.position).normalize();
                    returnTime = 1.4;
                }
                freeLook = false;
            };
            const requestTravel = (value: number, explicit = false) => {
                if (explicit) pendingTravel = undefined;
                if (dragging && !explicit) {
                    pendingTravel = value;
                    return;
                }
                const changed = explicit || Math.abs(value - target) > 0.015;
                if (changed) resumeGuide();
                target = value;
                navigationDirty ||= changed;
                schedule();
            };
            const readScroll = () => {
                if (!knots.length || exploring) return;
                if (selectionScroll !== undefined) {
                    // The scroll event queued by a destination click must not
                    // overwrite that selection after the mobile layout resizes.
                    if (Math.abs(scrollY - selectionScroll) < 2) {
                        selectionScroll = undefined;
                        return;
                    }
                    selectionScroll = undefined;
                }
                centeredWorld = undefined;
                const previous = scrollJourney.current;
                const destination = scrollJourney.update(
                    scrollY,
                    knots,
                    innerHeight,
                );
                // A reading scroll inside the current region must not take
                // over manual exploration or interrupt an unfinished arrival.
                if (destination !== previous) requestTravel(destination);
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
                if (
                    motionButton.getAttribute("aria-pressed") !== String(paused)
                )
                    motionButton.setAttribute("aria-pressed", String(paused));
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
                const p = camera.position,
                    t = rig.target,
                    up = camera.up,
                    q = camera.quaternion;
                put(stage, "camera", triple(p.x, p.y, p.z, 4));
                put(stage, "distance", p.distanceTo(t).toFixed(4));
                put(stage, "cameraTarget", triple(t.x, t.y, t.z, 6));
                put(stage, "cameraUp", triple(up.x, up.y, up.z, 6));
                put(
                    stage,
                    "cameraQuaternion",
                    `${q.x.toFixed(7)},${q.y.toFixed(7)},${q.z.toFixed(7)},${q.w.toFixed(7)}`,
                );
                let clearance = Infinity;
                for (const g of visibleGlobes)
                    clearance = Math.min(
                        clearance,
                        p.distanceTo(g.position) - 1,
                    );
                put(stage, "cameraClearance", clearance.toFixed(6));
                put(
                    stage,
                    "cameraOwner",
                    freeLook
                        ? "manual"
                        : returnTime > 0
                          ? "returning"
                          : "guided",
                );
            };
            const setLabel = (index: number) => {
                if (index === lastWorld) return;
                lastWorld = index;
                playback.setWorld(worldIds[index]);
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
                entries.forEach((entry) =>
                    entry.classList.toggle(
                        "is-current",
                        entry === navigation.targets[index],
                    ),
                );
            };
            function schedule() {
                if (!frame && !disposed && visible && !document.hidden)
                    frame = requestAnimationFrame(tick);
            }
            let guidedElapsed = 0,
                landmark = "";
            const updateGuidedPose = (outpost?: Three.Group) => {
                goal.position
                    .copy(orbitDirection)
                    .multiplyScalar(orbitalDistance);
                goal.target.copy(origin);
                goal.up.copy(worldUp);
                if (!outpost || surfaceMix === 0) return;
                const pose = outpostCamera(
                    T,
                    outpost,
                    surfaceWorld === 1 ? "moon" : "mars",
                    guidedElapsed,
                    lunarLaunch?.positionAt,
                );
                landmark = pose.landmark;
                surfaceUp
                    .set(0, 1, 0)
                    .applyQuaternion(
                        outpost.getWorldQuaternion(worldQuaternion),
                    );
                const globe = planets.get(surfaceWorld)!;
                if (
                    departure &&
                    target === surfaceWorld &&
                    surfaceMix >= departure.mix
                )
                    departure = undefined;
                if (departure) {
                    const lift = T.MathUtils.smoothstep(
                        1 - surfaceMix / departure.mix,
                        0,
                        1,
                    );
                    goal.position.copy(
                        arcPosition(
                            T,
                            departure.pose.position,
                            goal.position,
                            globe.position,
                            lift,
                        ),
                    );
                    goal.target.copy(departure.pose.target).lerp(origin, lift);
                    goal.up
                        .copy(departure.pose.up)
                        .lerp(worldUp, lift)
                        .normalize();
                } else {
                    goal.position.copy(
                        arcPosition(
                            T,
                            approachDirection
                                .clone()
                                .multiplyScalar(orbitalDistance),
                            pose.position,
                            globe.position,
                            surfaceMix,
                        ),
                    );
                    goal.target.lerp(
                        pose.target,
                        T.MathUtils.smoothstep(surfaceMix, 0, 0.7),
                    );
                    goal.up.lerp(surfaceUp, surfaceMix).normalize();
                }
            };
            const tick = (time: number) => {
                frame = 0;
                if (disposed || !visible || document.hidden) return;
                // Keep only one rendered frame in flight, as on the homepage.
                if (renderFence) {
                    if (
                        gl.clientWaitSync(renderFence, 0, 0) ===
                        gl.TIMEOUT_EXPIRED
                    ) {
                        schedule();
                        return;
                    }
                    gl.deleteSync(renderFence);
                    renderFence = null;
                }
                const elapsedDelta = Math.min(
                    0.25,
                    (time - (lastTime || time)) / 1000,
                );
                const dt = Math.min(0.1, elapsedDelta);
                lastTime = time;
                const still = paused || motion.matches;
                const settle = motion.matches || (paused && navigationDirty);
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
                // Finish the ascent before translating the planets. Otherwise
                // the ground moves underneath a camera still metres above it.
                const leavingSurface =
                    surfaceMix > 0 && target !== surfaceWorld;
                if (leavingSurface && !departure && !freeLook) {
                    departure = {
                        pose: {
                            position: camera.position.clone(),
                            target: rig.target.clone(),
                            up: camera.up.clone(),
                        },
                        mix: surfaceMix,
                    };
                }
                if (settle && !freeLook) {
                    progress = Math.round(target);
                    departure = undefined;
                    orbitDirection.set(0, 0.18, 3.45).normalize();
                } else if (
                    !dragging &&
                    !freeLook &&
                    !still &&
                    surfaceMix === 0 &&
                    !departure
                )
                    progress += T.MathUtils.clamp(
                        (target - progress) * (1 - Math.exp(-dt * 4)),
                        -dt * 0.9,
                        dt * 0.9,
                    );
                if (Math.abs(target - progress) < 0.001 && !still && !freeLook)
                    progress = target;
                let from = Math.min(4, Math.floor(progress)),
                    to = Math.min(4, from + 1);
                const part = progress - from;
                let travel = T.MathUtils.smoothstep(part, 0.38, 1);
                if (settle && !freeLook) {
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
                    orbitalDistance = distance;
                    setLabel(travel > 0.5 ? to : from);
                    say(status, "");
                } else {
                    const retained = planets.get(lastWorld);
                    if (retained) {
                        retained.visible = true;
                        retained.position.set(0, 0, 0);
                    }
                    if (!retained) say(status, "Loading the orbital view…");
                    const unavailable = !first ? from : to;
                    if (failed.has(unavailable))
                        say(
                            status,
                            `${worldNames[unavailable]} could not load. Select it below to retry.`,
                        );
                }
                visibleGlobes.length = 0;
                for (const g of planets.values())
                    if (g.visible) visibleGlobes.push(g);
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
                const desiredSurface =
                    surfaceReady &&
                    target === near &&
                    Math.abs(progress - near) < 0.001
                        ? 1
                        : 0;
                if (desiredSurface > 0 && surfaceWorld !== near && !freeLook) {
                    surfaceWorld = near;
                    approachDirection.copy(orbitDirection);
                }
                if (!freeLook && (!still || settle))
                    surfaceMix = settle
                        ? desiredSurface
                        : T.MathUtils.damp(
                              surfaceMix,
                              desiredSurface,
                              desiredSurface > surfaceMix ? 1.35 : 3,
                              elapsedDelta,
                          );
                if (surfaceMix < 0.001) surfaceMix = 0;
                if (surfaceMix > 0.9995) surfaceMix = 1;
                if (
                    surfaceMix === 0 &&
                    camera.position.length() >= orbitalDistance * 0.96
                )
                    departure = undefined;
                playback.setWorld(worldIds[Math.max(0, lastWorld)]);
                playback.setActive(surfaceMix >= 0.98 && desiredSurface > 0.9);
                playback.setVisibility(visible && !document.hidden);
                playback.setPaused(paused);
                playback.setReducedMotion(motion.matches);
                playback.setManualOrbit(freeLook);
                const play = playback.tick(time);
                put(stage, "journeyTime", play.elapsed.toFixed(3));
                put(stage, "guidedTime", play.guidedElapsed.toFixed(3));
                put(stage, "surfaceProgress", surfaceMix.toFixed(4));
                put(stage, "surface", String(surfaceMix > 0.02));
                put(section, "surface", String(surfaceMix > 0.02));
                const outpost = outposts.get(surfaceWorld);
                guidedElapsed = play.guidedElapsed;
                if (!freeLook && surfaceMix === 0 && !still) {
                    if (Math.abs(target - progress) > 0.01)
                        orbitDirection
                            .copy(
                                arcPosition(
                                    T,
                                    orbitDirection,
                                    homeDirection,
                                    origin,
                                    1 - Math.exp(-dt * 1.5),
                                ),
                            )
                            .normalize();
                    else orbitDirection.applyAxisAngle(worldUp, -dt * 0.0126);
                }
                if (!freeLook) updateGuidedPose(outpost);
                if (outpost && surfaceMix > 0) {
                    outpost.getWorldPosition(anchor);
                    sun.target.position.copy(anchor);
                    sun.position.copy(anchor).add(sunOffset);
                    // The frustum only depends on the mode, so it is refitted
                    // when the mode changes rather than every frame.
                    if (shadowFrame !== "surface") {
                        shadowFrame = "surface";
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
                    }
                    put(
                        stage,
                        "surfaceAnchor",
                        triple(anchor.x, anchor.y, anchor.z, 5),
                    );
                    put(
                        stage,
                        "settlementAttached",
                        String(outpost.parent === planets.get(surfaceWorld)),
                    );
                } else if (!freeLook) {
                    sun.target.position.set(0, 0, 0);
                    if (lastWorld === 0)
                        sun.position.copy(sunlight).multiplyScalar(8);
                    else
                        sun.position
                            .set(5, 2, 1.8)
                            .normalize()
                            .multiplyScalar(8);
                    if (shadowFrame !== "orbit") {
                        shadowFrame = "orbit";
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
                }
                if (lunarLaunch) {
                    const active = lastWorld === 1 && surfaceMix >= 0.98;
                    if (lastWorld === 1) lunarElapsed = play.elapsed;
                    const launch = lunarLaunch.update(lunarElapsed);
                    put(
                        stage,
                        "launchState",
                        active ? (still ? "paused" : "running") : "inactive",
                    );
                    put(stage, "launchPhase", launch.phase);
                    put(stage, "launchCycle", String(launch.cycle));
                    put(
                        stage,
                        "launchPosition",
                        triple(
                            launch.position.x,
                            launch.position.y,
                            launch.position.z,
                            3,
                        ),
                    );
                }
                // On the ground the light is each world's own: hard and
                // white on the Moon, warm through Mars's dust. What fills
                // the shadows is the soil around them.
                const local = SURFACE_LIGHT[surfaceWorld === 2 ? 2 : 1];
                sun.color.copy(orbitSun).lerp(local.sun, surfaceMix);
                sun.intensity = T.MathUtils.lerp(
                    2.6,
                    local.strength,
                    surfaceMix,
                );
                ambient.color.copy(orbitFill).lerp(local.fill, surfaceMix);
                ambient.intensity = T.MathUtils.lerp(
                    0.055,
                    local.ambient,
                    surfaceMix,
                );
                const view = surfaceMix > 0.98 ? "surface" : "orbit";
                put(stage, "view", view);
                put(section, "view", view);
                put(stage, "navigation", freeLook ? "manual" : "guided");
                if (navigationLabel)
                    say(
                        navigationLabel,
                        exploring || freeLook
                            ? "Free exploration"
                            : surfaceMix > 0.98
                              ? "Guided exploration"
                              : "Scroll to travel",
                    );
                if (destinationLabel)
                    say(
                        destinationLabel,
                        surfaceMix > 0.98
                            ? landmark
                            : lastWorld === 0
                              ? "Earth · Our starting point"
                              : `${worldNames[Math.max(0, lastWorld)]} · ${surfaceMix > 0.1 ? "Descending to the settlement" : "Orbital approach"}`,
                    );
                if (freeLook) {
                    orbit.enableDamping = !still;
                    orbit.dampingFactor =
                        1 - Math.exp(-Math.max(dt, 1 / 60) * 10);
                    orbit.update(dt);
                }
                if (!paused || freeLook || settle)
                    rig.move(freeLook ? rig.manualPose() : goal, dt, {
                        instant: settle || (still && freeLook),
                        manual: freeLook,
                        center:
                            surfaceMix > 0
                                ? planets.get(surfaceWorld)?.position
                                : undefined,
                        globes: visibleGlobes,
                        ground:
                            surfaceMix > 0 && outpost
                                ? {
                                      globe: planets.get(surfaceWorld)!
                                          .position,
                                      at: anchor,
                                      ...SETTLEMENT_FLOOR,
                                  }
                                : undefined,
                    });
                returnTime = settle ? 0 : Math.max(0, returnTime - dt);
                navigationDirty =
                    navigationDirty &&
                    (!ready ||
                        ((near === 1 || near === 2) &&
                            !outposts.has(near) &&
                            !outpostFailures.has(near)));
                // Preserve depth precision in orbit. A surface-sized near
                // plane makes Earth's closely spaced cloud/surface layers flicker.
                // Close free exploration also needs to clear the ground, even
                // when its orbit pivot is still deep inside the globe.
                let groundClearance = Infinity;
                for (const g of visibleGlobes)
                    groundClearance = Math.min(
                        groundClearance,
                        camera.position.distanceTo(g.position) - TERRAIN_RADIUS,
                    );
                const nearPlane = T.MathUtils.clamp(
                    Math.min(
                        camera.position.distanceTo(rig.target) * 0.02,
                        groundClearance * 0.25,
                    ),
                    0.00008,
                    0.05,
                );
                if (Math.abs(camera.near - nearPlane) > 0.000001) {
                    camera.near = nearPlane;
                    camera.updateProjectionMatrix();
                }
                put(stage, "nearPlane", camera.near.toFixed(6));
                telemetry();
                if (earthrise) {
                    const moon = outposts.get(1);
                    earthrise.visible =
                        Boolean(moon) &&
                        surfaceWorld === 1 &&
                        surfaceMix > 0.02;
                    if (earthrise.visible) {
                        // Far enough that walking the town does not move it
                        // against the stars: it keeps its bearing, not its place.
                        earthrise.position
                            .copy(camera.position)
                            .addScaledVector(
                                earthriseToward
                                    .copy(EARTHRISE.toward)
                                    .applyQuaternion(
                                        moon!.getWorldQuaternion(earthriseTurn),
                                    ),
                                EARTHRISE.away,
                            );
                        earthrise.scale.setScalar(
                            EARTHRISE.radius *
                                T.MathUtils.smoothstep(surfaceMix, 0.02, 0.6),
                        );
                    }
                }
                // A settlement entirely beyond the horizon is not drawn, and
                // casts shadows only while the tight surface frustum is in use.
                // Mesh flags change no shader program, so nothing recompiles.
                for (const [index, group] of outposts) {
                    const parts = settlementParts(group),
                        globe = planets.get(index);
                    if (
                        !parts ||
                        !globe?.visible ||
                        !group.userData.planetAttached
                    )
                        continue;
                    toCamera.copy(camera.position).sub(globe.position);
                    const distance = toCamera.length();
                    const shown = settlementMayShow(
                        toCamera.dot(
                            settlementNormal
                                .copy(group.userData.surfaceNormal)
                                .applyQuaternion(globe.quaternion),
                        ) / distance,
                        distance,
                        parts.reach,
                        parts.height,
                    );
                    const casting =
                        shown && surfaceWorld === index && surfaceMix > 0;
                    for (const mesh of parts.meshes) {
                        mesh.visible = shown;
                        mesh.castShadow = casting && mesh.userData.casts;
                    }
                    // Centrifuge rings turn with the journey's own clock,
                    // so they stop when it does; so do landers and pods.
                    for (const [order, spinner] of parts.spinners.entries())
                        spinner.rotation.y =
                            (order % 2 ? -1 : 1) * play.elapsed * SPIN_RATE;
                    if (shown) traffic.get(index)?.update(play.elapsed);
                    settlementAirOf(group)?.update(
                        camera,
                        globe,
                        group,
                        sunToward.copy(sun.position).sub(sun.target.position),
                        surfaceWorld === index ? surfaceMix : 0,
                    );
                }
                render.getSize(pictureSize);
                captions.update(
                    camera,
                    surfaceMix > 0.98 ? outposts.get(surfaceWorld) : undefined,
                    pictureSize.x,
                    pictureSize.y,
                    performance.now(),
                );
                render.render(scene, camera);
                renderFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
                gl.flush();
                if (!firstFrameDrawn && ready) {
                    firstFrameDrawn = true;
                    render.domElement.style.visibility = "visible";
                    stage.dataset.firstFramePhase = phase;
                    stage.dataset.ready = "true";
                    cameraTools?.show();
                }
                put(stage, "progress", progress.toFixed(4));
                put(stage, "transition", travel.toFixed(4));
                put(stage, "state", still ? "paused" : "running");
                if (!still) schedule();
            };
            let sizedWidth = 0,
                sizedHeight = 0;
            const resize = () => {
                const w = stage.clientWidth,
                    h = stage.clientHeight;
                if (!w || !h) return;
                // Resizing clears the canvas, so skip it when nothing changed.
                if (w !== sizedWidth || h !== sizedHeight) {
                    sizedWidth = w;
                    sizedHeight = h;
                    render.setSize(w, h, false);
                    camera.aspect = w / h;
                    camera.updateProjectionMatrix();
                }
                measure();
                alignSelection();
                // A size/font/layout change must not move the selected world.
                // Only actual page scrolling updates the journey destination.
                schedule();
            };
            const syncMotion = () => {
                if (paused) navigationDirty = false;
                if (freeLook && (paused || motion.matches))
                    rig.beginManual(surfaceMix > 0.02);
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
            const setExploring = (active: boolean) => {
                exploring = active;
                pendingTravel = undefined;
                releaseAlignment();
                if (dragging) {
                    dragging = false;
                    orbit.disconnect();
                    orbit.connect(stage);
                }
                configureInput();
                section.dataset.exploring = String(active);
                if (active)
                    stage.setAttribute("aria-describedby", `${stage.id}-help`);
                else stage.removeAttribute("aria-describedby");
                cameraTools?.setActive(active);
                layout?.update();
                schedule();
            };
            const replay = () => {
                if (exploring) setExploring(false);
                pendingTravel = undefined;
                playback.setManualOrbit(true);
                playback.setManualOrbit(false);
                resumeGuide();
                target = Math.max(0, lastWorld);
                navigationDirty = true;
                if (surfaceMix < 0.01) {
                    orbitDirection.set(0, 0.18, 3.45).normalize();
                }
                schedule();
            };
            const beginManual = () => {
                if (freeLook) return;
                rig.beginManual(surfaceMix > 0.02);
                freeLook = true;
                returnTime = 0;
                departure = undefined;
                target = surfaceMix > 0 ? Math.round(progress) : progress;
                pendingTravel = undefined;
            };
            const exitExploration = () => {
                setExploring(false);
                if (freeLook) {
                    target = Math.max(0, lastWorld);
                    navigationDirty = true;
                    resumeGuide();
                }
                cameraTools?.focusToggle();
            };
            const resetView = () => {
                beginManual();
                updateGuidedPose(outposts.get(surfaceWorld));
                rig.setManualPose(goal, surfaceMix > 0.02);
                schedule();
            };
            const prepareInput = () => {
                beginManual();
                orbit.object.updateMatrix();
                orbit.enableDamping = !paused && !motion.matches;
            };
            const key = (event: KeyboardEvent) => {
                if (event.key === "Home" && isCameraShortcut(event)) {
                    event.preventDefault();
                    if (exploring) resetView();
                    else replay();
                } else if (applySceneCameraKey(event, orbit, prepareInput)) {
                    schedule();
                }
            };
            const cameraTools = bindCameraTools(section, {
                toggle: () => {
                    if (exploring) exitExploration();
                    else {
                        beginManual();
                        setExploring(true);
                        stage.focus({ preventScroll: true });
                    }
                },
                reset: resetView,
                zoom: (inward) => {
                    prepareInput();
                    zoomSceneCamera(orbit, inward);
                    schedule();
                },
            });
            const selections = buttons.map((button, i) => {
                const select = () => {
                    scrollJourney.select(i);
                    failed.delete(i);
                    outpostFailures.delete(i);
                    void ensurePlanet(i).catch(() => {});
                    void ensureOutpost(i);
                    centeredWorld = i;
                    measure();
                    alignSelection();
                    requestTravel(i, true);
                };
                button.addEventListener("click", select);
                return select;
            });
            const beginDrag = () => {
                prepareInput();
                dragging = true;
                stage.focus({ preventScroll: true });
                schedule();
            };
            const endDrag = () => {
                dragging = false;
                if (pendingTravel !== undefined) {
                    const next = pendingTravel;
                    pendingTravel = undefined;
                    requestTravel(next);
                }
                schedule();
            };
            orbit.addEventListener("start", beginDrag);
            orbit.addEventListener("end", endDrag);
            const orbitChanged = () => {
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
                const moveFocus =
                    exploring && section.contains(document.activeElement);
                cleanup?.();
                cleanup = undefined;
                status.textContent =
                    "The visual is unavailable. Your experience record remains readable.";
                start.textContent = "Try again";
                start.hidden = false;
                if (moveFocus) start.focus({ preventScroll: true });
            };
            window.addEventListener("scroll", readScroll, { passive: true });
            window.addEventListener("wheel", releaseAlignment, {
                passive: true,
            });
            window.addEventListener("touchstart", releaseAlignment, {
                passive: true,
            });
            window.addEventListener("pointerdown", releaseAlignment, {
                passive: true,
            });
            window.addEventListener("keydown", windowKey);
            window.addEventListener("resize", resize);
            window.visualViewport?.addEventListener("resize", resize);
            document.addEventListener("visibilitychange", visibility);
            motion.addEventListener("change", syncMotion);
            narrow.addEventListener("change", configureInput);
            motionButton.addEventListener("click", toggleMotion);
            replayButton.addEventListener("click", replay);
            stage.addEventListener("keydown", key);
            render.domElement.addEventListener("webglcontextlost", lost);
            let preloadTimer = 0;
            cleanup = () => {
                disposed = true;
                cancelAnimationFrame(frame);
                if (renderFence) gl.deleteSync(renderFence);
                clearInterval(preferenceTimer);
                clearInterval(phaseTimer);
                clearTimeout(preloadTimer);
                observer.disconnect();
                sizes.disconnect();
                window.removeEventListener("scroll", readScroll);
                window.removeEventListener("wheel", releaseAlignment);
                window.removeEventListener("touchstart", releaseAlignment);
                window.removeEventListener("pointerdown", releaseAlignment);
                window.removeEventListener("keydown", windowKey);
                window.removeEventListener("resize", resize);
                window.visualViewport?.removeEventListener("resize", resize);
                document.removeEventListener("visibilitychange", visibility);
                motion.removeEventListener("change", syncMotion);
                narrow.removeEventListener("change", configureInput);
                motionButton.removeEventListener("click", toggleMotion);
                replayButton.removeEventListener("click", replay);
                stage.removeEventListener("keydown", key);
                render.domElement.removeEventListener("webglcontextlost", lost);
                buttons.forEach((button, i) =>
                    button.removeEventListener("click", selections[i]),
                );
                cameraTools?.dispose();
                orbit.dispose();
                captions.dispose();
                outposts.forEach((group) => {
                    group.removeFromParent();
                    settlementAirOf(group)?.sky?.removeFromParent();
                    disposeOutpost(group);
                });
                satellites?.dispose();
                earthrise?.removeFromParent();
                earthrise?.traverse((object) => {
                    const mesh = object as Three.Mesh;
                    mesh.geometry?.dispose();
                    (mesh.material as Three.Material | undefined)?.dispose();
                });
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
                stage.removeAttribute("aria-describedby");
                section.dataset.exploring = "false";
                layout?.update();
            };
            stage.appendChild(render.domElement);
            stage.hidden = false;
            updateControl();
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
            if (cleanup) cleanup();
            else {
                disposeInput?.();
                renderer?.dispose();
            }
            cleanup = undefined;
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
        layout?.dispose();
    });
    window.addEventListener("pageshow", (event) => {
        pageActive = true;
        if (event.persisted) {
            layout = setupExperienceLayout(section);
            void initialize();
        }
    });
}
