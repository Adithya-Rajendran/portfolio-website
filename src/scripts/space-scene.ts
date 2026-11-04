import type * as Three from "three";
import { waitForSceneClock } from "../lib/scene-clock";
import type { SpaceStudy } from "./space-studies";

for (const figure of document.querySelectorAll<HTMLElement>(
    "[data-space-study]",
)) {
    const stage = figure.querySelector<HTMLElement>("[data-space-stage]")!;
    const button = figure.querySelector<HTMLButtonElement>(
        "[data-space-motion]",
    )!;
    const hint = figure.querySelector<HTMLElement>("[data-space-hint]")!;
    const kind = figure.dataset.spaceStudy as SpaceStudy;
    let cleanup: (() => void) | undefined,
        generation = 0,
        loading = false,
        active = true,
        paused = false;
    const initialize = async () => {
        if (loading || cleanup || !active) return;
        loading = true;
        const ticket = ++generation;
        let renderer: Three.WebGLRenderer | undefined;
        let teardown: (() => void) | undefined;
        const owned = new Set<Three.Texture>();
        try {
            const clock = await waitForSceneClock();
            const [
                T,
                { RoomEnvironment },
                { makeSpaceStudy },
                { makePlanet, disposePlanet },
            ] = await Promise.all([
                import("three"),
                import("three/addons/environments/RoomEnvironment.js"),
                import("./space-studies"),
                import("./planet-materials"),
            ]);
            if (!active || ticket !== generation) return;
            renderer = new T.WebGLRenderer({
                alpha: true,
                antialias: true,
                powerPreference: "low-power",
            });
            const render = renderer;
            render.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
            render.outputColorSpace = T.SRGBColorSpace;
            render.toneMapping = T.ACESFilmicToneMapping;
            render.toneMappingExposure = 1.25;
            render.shadowMap.enabled = true;
            render.shadowMap.type = T.PCFShadowMap;
            render.autoClear = false;
            render.setClearColor(0x000000, 0);
            const scene = new T.Scene();
            const planetScene = new T.Scene();
            const planetarySun = new T.DirectionalLight(0xffedd8, 2.8);
            planetarySun.position.set(-5, 3, 1);
            planetScene.add(planetarySun, new T.AmbientLight(0xabc6e5, 0.025));
            const camera = new T.PerspectiveCamera(36, 1, 0.1, 70);
            camera.position.set(0, 0.15, 9.5);
            const room = new RoomEnvironment();
            const pmrem = new T.PMREMGenerator(render);
            const environment = pmrem.fromScene(room, 0.04, 0.1, 100, {
                size: 128,
            });
            scene.environment = environment.texture;
            scene.environmentIntensity = 0.32;
            room.dispose();
            pmrem.dispose();
            const key = new T.DirectionalLight(0xffe6be, 2.5);
            key.position.set(-3.5, 5, 4);
            key.castShadow = true;
            key.shadow.mapSize.set(1024, 1024);
            Object.assign(key.shadow.camera, {
                left: -5,
                right: 5,
                top: 5,
                bottom: -5,
                near: 0.1,
                far: 20,
            });
            key.shadow.bias = -0.0002;
            key.shadow.normalBias = 0.015;
            scene.add(key);
            const rim = new T.DirectionalLight(0x8ec6ff, 1.8);
            rim.position.set(4, 1, -2);
            scene.add(rim);
            scene.add(new T.HemisphereLight(0xb1c7e0, 0x352318, 0.22));
            const model = makeSpaceStudy(kind);
            scene.add(model.root);
            const originalRotation = model.root.rotation.clone();
            let planet: Three.Group | undefined;
            let disposed = false,
                frame = 0,
                elapsed = 0,
                lastTime = 0,
                lastDraw = 0,
                visible = true;
            const reduced = matchMedia("(prefers-reduced-motion: reduce)");
            const pointer = new T.Vector2(),
                currentPointer = new T.Vector2();
            const syncButton = () => {
                button.hidden = false;
                button.disabled = reduced.matches;
                button.textContent = reduced.matches
                    ? "Still scene"
                    : paused
                      ? "Resume motion"
                      : "Pause motion";
                button.setAttribute("aria-pressed", String(paused));
                hint.hidden =
                    reduced.matches || !matchMedia("(hover: hover)").matches;
                figure.dataset.state =
                    reduced.matches || paused ? "paused" : "running";
            };
            const draw = () => {
                render.clear();
                render.render(planetScene, camera);
                render.render(scene, camera);
            };
            const tick = (time: number) => {
                frame = 0;
                if (disposed || !visible || document.hidden) {
                    lastTime = 0;
                    return;
                }
                const still = reduced.matches || paused;
                if (!still && time - lastDraw < 1000 / 30) {
                    frame = requestAnimationFrame(tick);
                    return;
                }
                lastDraw = time;
                const dt = Math.min((time - (lastTime || time)) / 1000, 0.05);
                lastTime = time;
                if (!still) {
                    elapsed += dt;
                    currentPointer.lerp(pointer, 1 - Math.exp(-dt * 2.5));
                    model.root.rotation.y =
                        originalRotation.y +
                        Math.sin(elapsed * 0.12) * 0.07 +
                        currentPointer.x * 0.16;
                    model.root.rotation.x =
                        originalRotation.x + currentPointer.y * 0.1;
                    model.root.position.y = Math.sin(elapsed * 0.22) * 0.045;
                    model.update(elapsed);
                    if (planet) planet.rotation.y += dt * 0.007;
                }
                draw();
                if (!still) frame = requestAnimationFrame(tick);
            };
            const wake = () => {
                if (!frame && !disposed && visible && !document.hidden)
                    frame = requestAnimationFrame(tick);
            };
            const sync = () => {
                cancelAnimationFrame(frame);
                frame = 0;
                lastTime = 0;
                syncButton();
                wake();
            };
            const resize = () => {
                const width = stage.clientWidth,
                    height = stage.clientHeight;
                if (!width || !height) return;
                camera.aspect = width / height;
                camera.position.z = camera.aspect < 1.2 ? 10.9 : 9.5;
                camera.updateProjectionMatrix();
                render.setSize(width, height, false);
                draw();
            };
            const move = (event: PointerEvent) => {
                if (event.pointerType !== "mouse" || reduced.matches || paused)
                    return;
                const bounds = stage.getBoundingClientRect();
                pointer.set(
                    (event.clientX - bounds.left) / bounds.width - 0.5,
                    (event.clientY - bounds.top) / bounds.height - 0.5,
                );
            };
            const leave = () => pointer.set(0, 0);
            const toggle = () => {
                paused = !paused;
                sync();
            };
            const visibility = () => {
                if (document.hidden) {
                    cancelAnimationFrame(frame);
                    frame = 0;
                    lastTime = 0;
                    figure.dataset.state = "paused";
                } else {
                    syncButton();
                    wake();
                }
            };
            const lost = (event: Event) => {
                event.preventDefault();
                cleanup?.();
                cleanup = undefined;
                figure.dataset.state = "unavailable";
            };
            const sizes = new ResizeObserver(resize);
            const observer = new IntersectionObserver(([entry]) => {
                visible = entry.isIntersecting;
                if (!visible) {
                    cancelAnimationFrame(frame);
                    frame = 0;
                    lastTime = 0;
                    figure.dataset.state = "paused";
                } else {
                    syncButton();
                    wake();
                }
            });
            teardown = () => {
                disposed = true;
                cancelAnimationFrame(frame);
                sizes.disconnect();
                observer.disconnect();
                stage.removeEventListener("pointermove", move);
                stage.removeEventListener("pointerleave", leave);
                button.removeEventListener("click", toggle);
                reduced.removeEventListener("change", sync);
                document.removeEventListener("visibilitychange", visibility);
                render.domElement.removeEventListener("webglcontextlost", lost);
                model.dispose();
                if (planet) disposePlanet(planet);
                owned.forEach((t) => t.dispose());
                environment.dispose();
                key.shadow.map?.dispose();
                render.dispose();
                render.domElement.remove();
                button.hidden = true;
                hint.hidden = true;
                delete figure.dataset.ready;
            };
            cleanup = teardown;
            render.domElement.addEventListener("webglcontextlost", lost);
            const loader = new T.TextureLoader();
            const texture = async (name: string, color = true) => {
                const value = await loader.loadAsync(
                    `/images/trajectory/${name}.webp`,
                );
                if (color) value.colorSpace = T.SRGBColorSpace;
                value.anisotropy = Math.min(
                    4,
                    render.capabilities.getMaxAnisotropy(),
                );
                if (disposed) value.dispose();
                else owned.add(value);
                return value;
            };
            const night = clock.phase === "night",
                warm = clock.phase === "dawn" || clock.phase === "dusk";
            const lighting = {
                sunDirection: {
                    value: new T.Vector3(
                        ...((night ? [-3.5, 1.5, -1.7] : [3, 2, 4]) as [
                            number,
                            number,
                            number,
                        ]),
                    ).normalize(),
                },
                sunColor: { value: new T.Color(warm ? 0xffd4a6 : 0xfff1df) },
                sunStrength: { value: 1.8 },
                ambientStrength: { value: 0.04 },
                twilightStrength: { value: warm ? 1 : 0.3 },
                cloudOffset: { value: 0 },
            };
            const world =
                kind === "workshop"
                    ? "moon"
                    : kind === "observatory"
                      ? "saturn"
                      : kind === "robotics"
                        ? "mars"
                        : "earth";
            try {
                const globe = await makePlanet(
                    T,
                    world,
                    true,
                    texture,
                    lighting,
                );
                if (disposed || ticket !== generation) {
                    disposePlanet(globe);
                    return;
                }
                planet = globe;
                globe.scale.setScalar(
                    kind === "relay"
                        ? 2.9
                        : kind === "observatory"
                          ? 1.35
                          : 2.15,
                );
                globe.position.set(
                    kind === "relay" ? 0.9 : 2.6,
                    kind === "relay" ? -1.05 : 1.25,
                    -5.5,
                );
                globe.rotation.set(
                    0.1,
                    kind === "relay" ? -1.5 : 0.8,
                    kind === "observatory" ? 0.15 : 0,
                );
                planetScene.add(globe);
            } catch {
                /* The instrument remains complete if an optional planet texture fails. */
            }
            if (disposed || ticket !== generation || !active) {
                teardown();
                return;
            }
            render.domElement.setAttribute("aria-hidden", "true");
            stage.appendChild(render.domElement);
            sizes.observe(stage);
            observer.observe(stage);
            stage.addEventListener("pointermove", move, { passive: true });
            stage.addEventListener("pointerleave", leave);
            button.addEventListener("click", toggle);
            reduced.addEventListener("change", sync);
            document.addEventListener("visibilitychange", visibility);
            resize();
            figure.dataset.ready = "true";
            figure.dataset.phase = clock.phase;
            sync();
        } catch {
            teardown?.();
            if (!teardown) {
                owned.forEach((t) => t.dispose());
                renderer?.dispose();
            }
            cleanup = undefined;
            figure.dataset.state = "unavailable";
        } finally {
            loading = false;
            if (ticket !== generation && active) void initialize();
        }
    };
    const observer = new IntersectionObserver(
        ([entry]) => {
            if (entry.isIntersecting) {
                observer.disconnect();
                void initialize();
            }
        },
        { rootMargin: "250px" },
    );
    observer.observe(figure);
    window.addEventListener("pagehide", () => {
        active = false;
        generation++;
        observer.disconnect();
        cleanup?.();
        cleanup = undefined;
    });
    window.addEventListener("pageshow", (event) => {
        if (event.persisted) {
            active = true;
            void initialize();
        }
    });
}
