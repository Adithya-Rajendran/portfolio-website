import type * as Three from "three";
import {
    makePlanet,
    disposePlanet,
    worldNames,
    type World,
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
const poster = section?.querySelector<HTMLElement>("[data-experience-poster]");
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
        try {
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
            render.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
            render.outputColorSpace = T.SRGBColorSpace;
            render.toneMapping = T.ACESFilmicToneMapping;
            render.toneMappingExposure = 1.05;
            render.setClearColor(0x080f12, 0);
            render.shadowMap.enabled = true;
            render.shadowMap.type = T.PCFShadowMap;
            const scene = new T.Scene();
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
            const sunlight = new T.Vector3(5, 2, 1.8).normalize();
            const sun = new T.DirectionalLight(0xffedda, 2.6);
            sun.position.copy(sunlight).multiplyScalar(8);
            sun.castShadow = true;
            sun.shadow.mapSize.set(1024, 1024);
            Object.assign(sun.shadow.camera, {
                left: -3,
                right: 3,
                top: 3,
                bottom: -3,
            });
            sun.shadow.bias = -0.0002;
            scene.add(sun);
            scene.add(new T.AmbientLight(0x8cadd3, 0.055));
            const loader = new T.TextureLoader(),
                textures = new Map<string, Promise<Three.Texture>>(),
                owned = new Set<Three.Texture>();
            const planets = new Map<number, Three.Group>(),
                pending = new Map<number, Promise<Three.Group>>();
            let disposed = false;
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
                ((navigator as Navigator & { deviceMemory?: number })
                    .deviceMemory || 8) <= 4;
            const failed = new Set<number>();
            const ensurePlanet = (index: number) => {
                let value = pending.get(index);
                if (!value) {
                    value = makePlanet(
                        T,
                        worldIds[index],
                        small,
                        texture,
                        sunlight,
                    )
                        .then((group) => {
                            if (disposed) {
                                disposePlanet(group);
                                return group;
                            }
                            group.visible = false;
                            planets.set(index, group);
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
                if (!knots.length) return;
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
                current.textContent = worldNames[index];
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
                const dt = Math.min(0.05, (time - (lastTime || time)) / 1000);
                lastTime = time;
                updateControl();
                const still = paused || motion.matches;
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
                    camera.position
                        .copy(orbit.target)
                        .addScaledVector(direction, distance * manualZoom);
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
                orbit.autoRotate =
                    !still && !dragging && Math.abs(target - progress) < 0.01;
                orbit.autoRotateSpeed = 0.12;
                orbit.update();
                telemetry();
                render.render(scene, camera);
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
                readScroll();
                schedule();
            };
            const syncMotion = () => {
                updateControl();
                schedule();
            };
            const toggleMotion = () => {
                paused = !paused;
                syncMotion();
            };
            const reset = () => {
                manualZoom = 1;
                camera.position.set(
                    0,
                    0.18,
                    baseDistance(Math.max(0, lastWorld)),
                );
                orbit.target.set(0, 0, 0);
                orbit.update();
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
                else if (event.key === "+" || event.key === "=")
                    manualZoom = Math.max(0.7, manualZoom * 0.85);
                else if (event.key === "-")
                    manualZoom = Math.min(2.2, manualZoom / 0.85);
                else return;
                event.preventDefault();
                camera.position.setFromSpherical(s).add(orbit.target);
                orbit.update();
                schedule();
            };
            const selections = buttons.map((button, i) => {
                const select = () => {
                    failed.delete(i);
                    void ensurePlanet(i).catch(() => {});
                    window.scrollTo({
                        top: knots[i] || 0,
                        behavior: "instant",
                    });
                    readScroll();
                };
                button.addEventListener("click", select);
                return select;
            });
            const beginDrag = () => {
                dragging = true;
            };
            const endDrag = () => {
                dragging = false;
                schedule();
            };
            orbit.addEventListener("start", beginDrag);
            orbit.addEventListener("end", endDrag);
            orbit.addEventListener("change", telemetry);
            const observer = new IntersectionObserver((items) => {
                visible = items[0]?.isIntersecting ?? false;
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
                if (document.hidden && frame) {
                    cancelAnimationFrame(frame);
                    frame = 0;
                } else schedule();
            };
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
                orbit.dispose();
                planets.forEach(disposePlanet);
                owned.forEach((t) => t.dispose());
                starsGeo.dispose();
                starsMat.dispose();
                sun.shadow.dispose();
                render.dispose();
                render.domElement.remove();
                stage.hidden = true;
                panel.hidden = true;
                if (poster) poster.hidden = false;
            };
            stage.appendChild(render.domElement);
            stage.hidden = false;
            panel.hidden = false;
            resize();
            await ensurePlanet(0);
            if (disposed) return;
            if (poster) poster.hidden = true;
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
            if (poster) poster.hidden = false;
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
