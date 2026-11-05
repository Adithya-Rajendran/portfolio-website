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
    const poster = figure.querySelector<HTMLElement>("[data-space-poster]")!;
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
                { makeStudySetting },
                { makePlanet, disposePlanet },
            ] = await Promise.all([
                import("three"),
                import("three/addons/environments/RoomEnvironment.js"),
                import("./space-studies"),
                import("./space-settings"),
                import("./planet-materials"),
            ]);
            if (!active || ticket !== generation) return;
            renderer = new T.WebGLRenderer({
                alpha: true,
                antialias: true,
                powerPreference: "low-power",
            });
            const render = renderer;
            render.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
            render.outputColorSpace = T.SRGBColorSpace;
            render.toneMapping = T.ACESFilmicToneMapping;
            render.toneMappingExposure = 1.1;
            render.shadowMap.enabled = true;
            render.shadowMap.type = T.PCFShadowMap;
            render.autoClear = false;
            render.setClearColor(0x000000, 0);
            const scene = new T.Scene();
            if (kind === "robotics") scene.fog = new T.FogExp2(0x101719, 0.025);
            const planetScene = new T.Scene();
            const planetarySun = new T.DirectionalLight(0xffedd8, 1.8);
            planetarySun.position.set(-6, 4, 0);
            planetScene.add(planetarySun, new T.AmbientLight(0xabc6e5, 0.025));
            const camera = new T.PerspectiveCamera(36, 1, 0.1, 150);
            camera.position.set(0, kind === "robotics" ? 1.1 : 0.3, 11.4);
            const aim = new T.Vector3(
                0,
                kind === "observatory" ? -0.4 : -0.1,
                0,
            );
            camera.lookAt(aim);
            const room = new RoomEnvironment();
            const pmrem = new T.PMREMGenerator(render);
            const environment = pmrem.fromScene(room, 0.04, 0.1, 100, {
                size: 128,
            });
            scene.environment = environment.texture;
            scene.environmentIntensity = 0.3;
            room.dispose();
            pmrem.dispose();
            const key = new T.DirectionalLight(0xffd3a0, 3.4);
            key.position.set(-5, 6, 3);
            key.castShadow = true;
            key.shadow.mapSize.set(1024, 1024);
            Object.assign(key.shadow.camera, {
                left: -7,
                right: 7,
                top: 7,
                bottom: -7,
                near: 0.1,
                far: 45,
            });
            key.shadow.bias = -0.0002;
            key.shadow.normalBias = 0.015;
            scene.add(key);
            const rim = new T.DirectionalLight(0x8db4d2, 1.6);
            rim.position.set(4, 2, -3);
            scene.add(rim);
            scene.add(new T.HemisphereLight(0xb1c7e0, 0x352318, 0.22));
            const model = makeSpaceStudy(kind);
            const setting = makeStudySetting(kind);
            const complete = Promise.all([setting.ready, model.ready]);
            // Register rejection immediately while optional planetary maps load.
            // The awaited promise still sends failures to the static-art fallback.
            void complete.catch(() => {});
            scene.add(model.root);
            scene.add(setting.root);
            const originalRotation = model.root.rotation.clone();
            let planet: Three.Group | undefined;
            let disposed = false,
                frame = 0,
                elapsed = 0,
                lastTime = 0,
                lastDraw = 0,
                visible = true;
            let revealFrame = 0;
            let reveal: Animation | undefined;
            let firstFrameFence: WebGLSync | null = null;
            let endLifetime: () => void = () => {};
            const lifetime = new Promise<void>((resolve) => {
                endLifetime = resolve;
            });
            const gl = render.getContext() as WebGL2RenderingContext;
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
                figure.dataset.sceneTime = elapsed.toFixed(3);
                figure.dataset.drawCalls = String(render.info.render.calls);
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
                        (kind === "robotics"
                            ? 0
                            : Math.sin(elapsed * 0.12) * 0.025);
                    model.root.position.y =
                        kind === "robotics"
                            ? 0
                            : Math.sin(elapsed * 0.22) * 0.025;
                    camera.position.x = currentPointer.x * 0.65;
                    camera.position.y =
                        (kind === "robotics" ? 1.1 : 0.3) +
                        currentPointer.y * 0.3;
                    camera.lookAt(aim);
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
                // Match the picture breakpoint, including narrow desktop windows,
                // so the still and first live frame use the same camera distance.
                camera.position.z = matchMedia("(max-width: 800px)").matches
                    ? 12.7
                    : 11.4;
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
                if (disposed) return;
                disposed = true;
                endLifetime();
                cancelAnimationFrame(frame);
                cancelAnimationFrame(revealFrame);
                reveal?.cancel();
                if (firstFrameFence) gl.deleteSync(firstFrameFence);
                firstFrameFence = null;
                sizes.disconnect();
                observer.disconnect();
                stage.removeEventListener("pointermove", move);
                stage.removeEventListener("pointerleave", leave);
                button.removeEventListener("click", toggle);
                reduced.removeEventListener("change", sync);
                document.removeEventListener("visibilitychange", visibility);
                render.domElement.removeEventListener("webglcontextlost", lost);
                model.dispose();
                setting.dispose();
                if (planet) disposePlanet(planet);
                owned.forEach((t) => t.dispose());
                environment.dispose();
                key.shadow.map?.dispose();
                render.dispose();
                render.domElement.remove();
                button.hidden = true;
                hint.hidden = true;
                delete figure.dataset.ready;
                poster.hidden = false;
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
                if (kind !== "robotics") {
                    const pendingGlobe = makePlanet(
                        T,
                        world,
                        true,
                        texture,
                        lighting,
                    ).then((globe) => {
                        if (disposed || ticket !== generation || !active) {
                            disposePlanet(globe);
                            return undefined;
                        }
                        return globe;
                    });
                    const globe = await Promise.race([
                        pendingGlobe,
                        lifetime.then(() => undefined),
                    ]);
                    if (!globe) return;
                    planet = globe;
                    globe.scale.setScalar(
                        kind === "relay"
                            ? 8.5
                            : kind === "observatory"
                              ? 3.1
                              : 9,
                    );
                    if (kind === "relay") globe.position.set(0.8, -8.7, -6.5);
                    else if (kind === "observatory")
                        globe.position.set(11, 2.5, -12);
                    else globe.position.set(5.5, -7.7, -8);
                    globe.rotation.set(
                        0.1,
                        kind === "relay" ? -1.5 : 0.8,
                        kind === "observatory" ? 0.15 : 0,
                    );
                    planetScene.add(globe);
                }
            } catch {
                /* The instrument remains complete if an optional planet texture fails. */
            }
            await Promise.race([complete, lifetime]);
            originalRotation.copy(model.root.rotation);
            if (disposed || ticket !== generation || !active) {
                teardown();
                return;
            }
            render.domElement.setAttribute("aria-hidden", "true");
            stage.appendChild(render.domElement);
            resize();
            await Promise.race([
                Promise.all([
                    render.compileAsync(scene, camera),
                    render.compileAsync(planetScene, camera),
                ]),
                lifetime,
            ]);
            if (disposed || ticket !== generation || !active) {
                teardown();
                return;
            }
            draw();
            firstFrameFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
            gl.flush();
            await Promise.race([
                new Promise<void>((resolve, reject) => {
                    const check = () => {
                        if (disposed || gl.isContextLost()) {
                            resolve();
                            return;
                        }
                        const status = firstFrameFence
                            ? gl.clientWaitSync(firstFrameFence, 0, 0)
                            : gl.CONDITION_SATISFIED;
                        if (status === gl.TIMEOUT_EXPIRED) {
                            revealFrame = requestAnimationFrame(check);
                            return;
                        }
                        if (firstFrameFence) gl.deleteSync(firstFrameFence);
                        firstFrameFence = null;
                        if (status === gl.WAIT_FAILED)
                            reject(new Error("Scene frame unavailable"));
                        else resolve();
                    };
                    revealFrame = requestAnimationFrame(check);
                }),
                lifetime,
            ]);
            if (
                disposed ||
                ticket !== generation ||
                !active ||
                gl.isContextLost()
            ) {
                teardown();
                return;
            }
            if (!reduced.matches) {
                reveal = stage.animate([{ opacity: 0 }, { opacity: 1 }], {
                    duration: 650,
                    easing: "ease-out",
                    fill: "forwards",
                });
                await Promise.race([reveal.finished.catch(() => {}), lifetime]);
                if (disposed || ticket !== generation || !active) {
                    teardown();
                    return;
                }
            }
            sizes.observe(stage);
            observer.observe(stage);
            stage.addEventListener("pointermove", move, { passive: true });
            stage.addEventListener("pointerleave", leave);
            button.addEventListener("click", toggle);
            reduced.addEventListener("change", sync);
            document.addEventListener("visibilitychange", visibility);
            resize();
            figure.dataset.ready = "true";
            poster.hidden = true;
            reveal?.cancel();
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
