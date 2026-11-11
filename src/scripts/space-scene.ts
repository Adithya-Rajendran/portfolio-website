import type * as Three from "three";
import { waitForSceneClock } from "../lib/scene-clock";
import type { SpaceStudy } from "./space-studies";
import { studyWorlds } from "./study-worlds";

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
        const startupCleanup: Array<() => void> = [];
        const owned = new Set<Three.Texture>();
        try {
            const clock = await waitForSceneClock();
            const [
                T,
                { makeStudyEnvironment },
                { makeStudyRendering },
                { makeSpaceStudy },
                { makeStudySetting },
                { makePlanet, disposePlanet },
                { makeInlineOrbit },
            ] = await Promise.all([
                import("three"),
                import("./study-lighting"),
                import("./study-rendering"),
                import("./space-studies"),
                import("./space-settings"),
                import("./planet-materials"),
                import("./inline-orbit"),
            ]);
            if (!active || ticket !== generation) return;
            renderer = new T.WebGLRenderer({
                alpha: true,
                // Every frame is resolved from the multisampled colour target
                // and copied by a full-screen quad, so the canvas needs none.
                antialias: false,
                powerPreference: "high-performance",
            });
            const render = renderer;
            render.info.autoReset = false;
            render.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
            render.outputColorSpace = T.SRGBColorSpace;
            render.toneMapping = T.ACESFilmicToneMapping;
            render.toneMappingExposure = 1.05;
            render.shadowMap.enabled = true;
            render.shadowMap.type = T.PCFShadowMap;
            render.autoClear = false;
            render.setClearColor(0x000000, 0);
            const scene = new T.Scene();
            if (kind === "robotics")
                scene.fog = new T.FogExp2(0x45464d, 0.0065);
            const planetScene = new T.Scene();
            // The Moon is as dark as asphalt: beside a sunlit station it needs
            // the camera's exposure, and the station's own sun, to read at all.
            const planetarySun = new T.DirectionalLight(
                0xffedd8,
                kind === "workshop" ? 15 : 1.8,
            );
            if (kind === "workshop") planetarySun.position.set(-5, 5, 1);
            else planetarySun.position.set(-6, 4, 0);
            // Earthshine: enough that the Moon's night side is not a hole in
            // the page's own sky.
            planetScene.add(
                planetarySun,
                new T.AmbientLight(0xabc6e5, kind === "workshop" ? 0.3 : 0.025),
            );
            const camera = new T.PerspectiveCamera(36, 1, 0.1, 2400);
            const eyeHeight =
                kind === "workshop" ? 3.7 : kind === "robotics" ? 1.1 : 0.3;
            camera.position.set(0, eyeHeight, 11.4);
            const aim = new T.Vector3(
                0,
                kind === "observatory" ? -0.4 : -0.1,
                0,
            );
            camera.lookAt(aim);
            const environment = makeStudyEnvironment(render, scene);
            startupCleanup.push(() => environment.dispose());
            scene.environment = environment.texture;
            scene.environmentIntensity = 0.4;
            const key = new T.DirectionalLight(0xffc58c, 2.8);
            key.position.set(-5, 5, 1);
            key.castShadow = true;
            key.shadow.mapSize.set(2048, 2048);
            Object.assign(key.shadow.camera, {
                left: -7,
                right: 7,
                top: 7,
                bottom: -7,
                near: 0.1,
                far: 45,
            });
            key.shadow.camera.updateProjectionMatrix();
            key.shadow.bias = -0.0002;
            key.shadow.normalBias = 0.008;
            scene.add(key);
            const rim = new T.DirectionalLight(0x8db4d2, 0.85);
            rim.position.set(4, 2, -3);
            scene.add(rim);
            scene.add(new T.HemisphereLight(0xb1c7e0, 0x352318, 0.08));
            const model = makeSpaceStudy(kind, {
                anisotropy: Math.min(4, render.capabilities.getMaxAnisotropy()),
                // A phone gets the lighter build of a loaded model.
                lite: matchMedia("(max-width: 800px)").matches,
            });
            startupCleanup.push(() => model.dispose());
            const setting = makeStudySetting(kind);
            startupCleanup.push(() => setting.dispose());
            const complete = Promise.all([
                setting.ready,
                model.ready,
                environment.ready,
            ]);
            // Register rejection immediately while optional planetary maps load.
            // The awaited promise still sends failures to the static-art fallback.
            void complete.catch(() => {});
            scene.add(model.root);
            scene.add(setting.root);
            const originalRotation = model.root.rotation.clone();
            const rendering = makeStudyRendering(
                render,
                scene,
                planetScene,
                camera,
            );
            startupCleanup.push(() => rendering.dispose());
            let planet: Three.Group | undefined;
            let disposed = false,
                compiled = false,
                frame = 0,
                elapsed = 0,
                lastTime = 0,
                lastDraw = 0,
                visible = true;
            let revealFrame = 0;
            let reveal: Animation | undefined;
            let firstFrameFence: WebGLSync | null = null;
            let renderFence: WebGLSync | null = null;
            let lastWidth = 0,
                lastHeight = 0;
            // Full rate while the visitor interacts or the view is settling;
            // idle drift moves about a pixel a second and needs far fewer frames.
            const activeInterval = 1000 / 30,
                idleInterval = 1000 / 12 - 4,
                hold = 1000;
            let activeUntil = 0,
                easing = false;
            const boost = () => {
                const now = performance.now();
                // Draw at once when leaving the idle rate; later input only
                // extends the window so the rate stays capped at 30 fps.
                if (now >= activeUntil) lastDraw = 0;
                activeUntil = now + hold;
            };
            let shownTime = "",
                shownCalls = "",
                shownTriangles = "";
            let endLifetime: () => void = () => {};
            const lifetime = new Promise<void>((resolve) => {
                endLifetime = resolve;
            });
            const gl = render.getContext() as WebGL2RenderingContext;
            const reduced = matchMedia("(prefers-reduced-motion: reduce)");
            let reflectedReduced = reduced.matches;
            let orbit: ReturnType<typeof makeInlineOrbit> | undefined;
            const resetButton =
                figure.querySelector<HTMLButtonElement>("[data-space-reset]")!;
            const zoomIn = figure.querySelector<HTMLButtonElement>(
                "[data-space-closer]",
            )!;
            const zoomOut = figure.querySelector<HTMLButtonElement>(
                "[data-space-further]",
            )!;
            const syncButton = () => {
                reflectedReduced = reduced.matches;
                button.hidden = false;
                button.disabled = reduced.matches;
                const label = reduced.matches
                    ? "Still scene"
                    : paused
                      ? "Resume motion"
                      : "Pause motion";
                if (button.textContent !== label) button.textContent = label;
                const pressed = String(paused);
                if (button.getAttribute("aria-pressed") !== pressed)
                    button.setAttribute("aria-pressed", pressed);
                hint.hidden = false;
                const state = reduced.matches || paused ? "paused" : "running";
                if (figure.dataset.state !== state)
                    figure.dataset.state = state;
            };
            const draw = (updateShadows = true) => {
                render.info.reset();
                rendering.render(updateShadows);
                // Keep at most one frame in flight; slow GPUs must not queue work
                // until the command buffer blocks keyboard and scrolling events.
                if (renderFence) gl.deleteSync(renderFence);
                renderFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
                gl.flush();
                const time = elapsed.toFixed(3),
                    calls = String(render.info.render.calls),
                    triangles = String(render.info.render.triangles);
                if (time !== shownTime)
                    figure.dataset.sceneTime = shownTime = time;
                if (calls !== shownCalls)
                    figure.dataset.drawCalls = shownCalls = calls;
                if (triangles !== shownTriangles)
                    figure.dataset.triangles = shownTriangles = triangles;
            };
            const tick = (time: number) => {
                frame = 0;
                if (disposed || !visible || document.hidden) {
                    lastTime = 0;
                    return;
                }
                if (reduced.matches !== reflectedReduced) syncButton();
                if (renderFence) {
                    if (
                        gl.clientWaitSync(renderFence, 0, 0) ===
                        gl.TIMEOUT_EXPIRED
                    ) {
                        frame = requestAnimationFrame(tick);
                        return;
                    }
                    gl.deleteSync(renderFence);
                    renderFence = null;
                }
                const still = reduced.matches || paused;
                const fast = time < activeUntil || easing;
                if (time - lastDraw < (fast ? activeInterval : idleInterval)) {
                    frame = requestAnimationFrame(tick);
                    return;
                }
                lastDraw = time;
                const cameraDelta = (time - (lastTime || time)) / 1000;
                // The ambient step is capped for stalls only; the idle rate must
                // not slow the drift, so its frames may span a longer step.
                const dt = Math.min(cameraDelta, fast ? 0.05 : 0.25);
                lastTime = time;
                if (!still) {
                    elapsed += dt;
                    model.root.rotation.y =
                        originalRotation.y +
                        (kind === "robotics"
                            ? 0
                            : Math.sin(elapsed * 0.12) * 0.025);
                    model.root.position.y =
                        kind === "robotics"
                            ? 0
                            : Math.sin(elapsed * 0.22) * 0.025;
                    model.update(elapsed);
                    if (planet) planet.rotation.y += dt * 0.007;
                }
                // Input follows wall time even when a slow GPU skips frames;
                // only ambient animation uses the capped simulation step.
                const moving = orbit?.update(cameraDelta, reduced.matches);
                easing = Boolean(moving);
                draw(!still);
                if (!still || moving) frame = requestAnimationFrame(tick);
            };
            const wake = () => {
                // Orbit input, zoom, reset and keys all arrive through here.
                boost();
                if (
                    compiled &&
                    !frame &&
                    !disposed &&
                    visible &&
                    !document.hidden
                ) {
                    lastTime = performance.now();
                    frame = requestAnimationFrame(tick);
                }
            };
            const sync = () => {
                boost();
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
                const distance = matchMedia("(max-width: 800px)").matches
                    ? 12.7
                    : 11.4;
                if (width === lastWidth && height === lastHeight) return;
                lastWidth = width;
                lastHeight = height;
                camera.aspect = width / height;
                // Match the picture breakpoint, including narrow desktop windows,
                // so the still and first live frame use the same camera distance.
                if (orbit) {
                    orbit.setHome(new T.Vector3(0, eyeHeight, distance));
                    orbit.update(0, reduced.matches);
                } else {
                    camera.position.set(0, eyeHeight, distance);
                    camera.lookAt(aim);
                }
                camera.updateProjectionMatrix();
                render.setSize(width, height, false);
                rendering.resize(width, height);
                boost();
                if (compiled) wake();
            };
            const reset = () => orbit?.reset();
            const closer = () => orbit?.zoom(true);
            const further = () => orbit?.zoom(false);
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
            // Interaction that wake() does not see: pointer drags and touches,
            // wheel, keys and focus anywhere in the figure, plus a theme change.
            const interact = () => boost();
            const hover = (event: PointerEvent) => {
                if (event.buttons || event.pointerType === "touch") boost();
            };
            const interactions = [
                "pointerdown",
                "keydown",
                "focusin",
                "wheel",
                "touchstart",
                "touchmove",
            ] as const;
            const theme = new MutationObserver(interact);
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
                if (renderFence) gl.deleteSync(renderFence);
                renderFence = null;
                sizes.disconnect();
                observer.disconnect();
                theme.disconnect();
                for (const name of interactions)
                    figure.removeEventListener(name, interact);
                figure.removeEventListener("pointermove", hover);
                orbit?.dispose();
                orbit = undefined;
                resetButton.removeEventListener("click", reset);
                zoomIn.removeEventListener("click", closer);
                zoomOut.removeEventListener("click", further);
                button.removeEventListener("click", toggle);
                reduced.removeEventListener("change", sync);
                document.removeEventListener("visibilitychange", visibility);
                render.domElement.removeEventListener("webglcontextlost", lost);
                rendering.dispose();
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
                        matchMedia("(max-width: 800px)").matches,
                        texture,
                        lighting,
                        "distant",
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
                    const worldPlacement = studyWorlds[kind];
                    globe.scale.setScalar(worldPlacement.radius);
                    globe.position.fromArray(worldPlacement.position);
                    globe.rotation.set(
                        kind === "observatory" ? 0.5 : 0.1,
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
            compiled = true;
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
            orbit = makeInlineOrbit({
                element: stage,
                camera,
                target: aim,
                wake,
                minPolar: 0.35,
                maxPolar: Math.PI / 2 - 0.035,
                maxYaw: kind === "robotics" ? 1.35 : Math.PI,
            });
            orbit.update(0, true);
            sizes.observe(stage);
            observer.observe(stage);
            for (const name of interactions)
                figure.addEventListener(name, interact, { passive: true });
            figure.addEventListener("pointermove", hover, { passive: true });
            theme.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ["data-theme"],
            });
            resetButton.addEventListener("click", reset);
            zoomIn.addEventListener("click", closer);
            zoomOut.addEventListener("click", further);
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
                startupCleanup.reverse().forEach((dispose) => dispose());
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
    // Data saving: keep the poster and wait for the visitor to engage with
    // the figure (its controls, focus or a tap) instead of downloading.
    const saving =
        Boolean(
            (navigator as Navigator & { connection?: { saveData?: boolean } })
                .connection?.saveData,
        ) || matchMedia("(prefers-reduced-data: reduce)").matches;
    let allowed = !saving;
    let idleStart = 0,
        idleTimer = 0;
    const manualEvents = ["pointerdown", "keydown", "focusin"] as const;
    const stopManual = () => {
        for (const name of manualEvents)
            figure.removeEventListener(name, manual);
    };
    function manual() {
        stopManual();
        allowed = true;
        void initialize();
    }
    // Start after the page's own text, fonts and styles have loaded.
    const afterLoad = () => {
        const start = () => {
            if (active) void initialize();
        };
        const schedule = () => {
            if ("requestIdleCallback" in window)
                idleStart = requestIdleCallback(start, { timeout: 2000 });
            else idleTimer = setTimeout(start, 200) as unknown as number;
        };
        if (document.readyState === "complete") schedule();
        else window.addEventListener("load", schedule, { once: true });
    };
    const observer = new IntersectionObserver(
        ([entry]) => {
            if (entry.isIntersecting) {
                observer.disconnect();
                if (allowed) afterLoad();
            }
        },
        { rootMargin: "250px" },
    );
    observer.observe(figure);
    if (saving)
        for (const name of manualEvents)
            figure.addEventListener(name, manual, { passive: true });
    window.addEventListener("pagehide", () => {
        active = false;
        generation++;
        observer.disconnect();
        if (idleStart) cancelIdleCallback(idleStart);
        clearTimeout(idleTimer);
        cleanup?.();
        cleanup = undefined;
    });
    window.addEventListener("pageshow", (event) => {
        if (event.persisted) {
            active = true;
            if (allowed) void initialize();
        }
    });
}
