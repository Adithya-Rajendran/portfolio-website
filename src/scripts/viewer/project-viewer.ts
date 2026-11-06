import type * as Three from "three";

for (const section of document.querySelectorAll<HTMLElement>(
    "[data-project-viewer]",
)) {
    const stage = section.querySelector<HTMLElement>("[data-viewer-stage]")!;
    const status = section.querySelector<HTMLElement>("[data-viewer-status]")!;
    const retryButton = section.querySelector<HTMLButtonElement>(
        "[data-viewer-retry]",
    )!;
    const motionButton = section.querySelector<HTMLButtonElement>(
        "[data-viewer-motion]",
    )!;
    const resetButton = section.querySelector<HTMLButtonElement>(
        "[data-viewer-reset]",
    )!;
    const closerButton = section.querySelector<HTMLButtonElement>(
        "[data-viewer-closer]",
    )!;
    const furtherButton = section.querySelector<HTMLButtonElement>(
        "[data-viewer-further]",
    )!;
    section.hidden = false;
    let cleanup: (() => void) | undefined;
    let generation = 0,
        active = true,
        loading = false,
        paused = false;
    const initialize = async () => {
        if (!active || loading || cleanup) return;
        loading = true;
        const ticket = ++generation;
        let renderer: Three.WebGLRenderer | undefined;
        let teardown: (() => void) | undefined;
        status.textContent = "Loading model…";
        retryButton.hidden = true;
        try {
            const [T, { makeInlineOrbit }, { loadProjectModel, disposeScene }] =
                await Promise.all([
                    import("three"),
                    import("../inline-orbit"),
                    import("./project-model"),
                ]);
            if (!active || ticket !== generation) return;
            const render = (renderer = new T.WebGLRenderer({
                antialias: true,
                alpha: true,
            }));
            render.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
            const scene = new T.Scene();
            const camera = new T.PerspectiveCamera(38, 1, 0.01, 100);
            camera.position.set(3, 2.3, 4.5);
            camera.lookAt(0, 0, 0);
            scene.add(new T.HemisphereLight(0xf5ead8, 0x302c28, 2));
            const light = new T.DirectionalLight(0xffffff, 2);
            light.position.set(3, 5, 4);
            scene.add(light);
            const group = new T.Group();
            scene.add(group);
            const reduced = matchMedia("(prefers-reduced-motion: reduce)");
            let disposed = false,
                compiled = false,
                visible = true,
                frame = 0,
                lastTime = 0,
                lastDraw = 0;
            let fence: WebGLSync | null = null;
            let orbit: ReturnType<typeof makeInlineOrbit> | undefined;
            const gl = render.getContext() as WebGL2RenderingContext;
            let endLifetime: () => void = () => {};
            const lifetime = new Promise<void>((resolve) => {
                endLifetime = resolve;
            });
            const syncButton = () => {
                motionButton.disabled = reduced.matches;
                motionButton.textContent = reduced.matches
                    ? "Still scene"
                    : paused
                      ? "Resume motion"
                      : "Pause motion";
                motionButton.setAttribute("aria-pressed", String(paused));
                section.dataset.state =
                    reduced.matches || paused ? "paused" : "running";
            };
            const tick = (time: number) => {
                frame = 0;
                if (disposed || !visible || document.hidden) {
                    lastTime = 0;
                    return;
                }
                if (fence) {
                    if (gl.clientWaitSync(fence, 0, 0) === gl.TIMEOUT_EXPIRED) {
                        frame = requestAnimationFrame(tick);
                        return;
                    }
                    gl.deleteSync(fence);
                    fence = null;
                }
                if (time - lastDraw < 1000 / 30) {
                    frame = requestAnimationFrame(tick);
                    return;
                }
                const cameraDelta = (time - (lastTime || time)) / 1000;
                const delta = Math.min(cameraDelta, 0.05);
                lastTime = lastDraw = time;
                const still = paused || reduced.matches;
                if (!still) group.rotation.y += delta * 0.18;
                const moving = orbit?.update(cameraDelta, reduced.matches);
                render.render(scene, camera);
                fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
                gl.flush();
                if (!still || moving) frame = requestAnimationFrame(tick);
            };
            const wake = () => {
                if (
                    compiled &&
                    !disposed &&
                    !frame &&
                    visible &&
                    !document.hidden
                ) {
                    lastTime = performance.now();
                    frame = requestAnimationFrame(tick);
                }
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
                render.setSize(width, height, false);
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
                wake();
            };
            const toggle = () => {
                paused = !paused;
                sync();
            };
            const reset = () => {
                group.rotation.y = 0;
                orbit?.reset();
            };
            const closer = () => orbit?.zoom(true);
            const further = () => orbit?.zoom(false);
            const lost = (event: Event) => {
                event.preventDefault();
                teardown?.();
                cleanup = undefined;
                section.dataset.state = "unavailable";
                status.textContent =
                    "The 3D model is unavailable. You can still read the project below.";
                retryButton.hidden = false;
            };
            const sizes = new ResizeObserver(resize);
            const observer = new IntersectionObserver(([entry]) => {
                visible = entry.isIntersecting;
                sync();
            });
            teardown = () => {
                if (disposed) return;
                disposed = true;
                endLifetime();
                cancelAnimationFrame(frame);
                if (fence) gl.deleteSync(fence);
                sizes.disconnect();
                observer.disconnect();
                orbit?.dispose();
                orbit = undefined;
                motionButton.removeEventListener("click", toggle);
                resetButton.removeEventListener("click", reset);
                closerButton.removeEventListener("click", closer);
                furtherButton.removeEventListener("click", further);
                document.removeEventListener("visibilitychange", sync);
                reduced.removeEventListener("change", sync);
                render.domElement.removeEventListener("webglcontextlost", lost);
                disposeScene(scene);
                render.dispose();
                render.domElement.remove();
                delete section.dataset.ready;
            };
            cleanup = teardown;
            const model = loadProjectModel(
                T,
                group,
                section.dataset.kind,
                section.dataset.url,
                () => disposed,
            );
            await Promise.race([model, lifetime]);
            if (disposed || !active || ticket !== generation) {
                teardown();
                return;
            }
            resize();
            await Promise.race([render.compileAsync(scene, camera), lifetime]);
            if (disposed || !active || ticket !== generation) {
                teardown();
                return;
            }
            orbit = makeInlineOrbit({
                element: stage,
                camera,
                target: new T.Vector3(),
                wake,
                onInteract: () => {
                    paused = true;
                    syncButton();
                },
            });
            orbit.update(0, true);
            render.domElement.setAttribute("aria-hidden", "true");
            stage.appendChild(render.domElement);
            render.domElement.addEventListener("webglcontextlost", lost);
            motionButton.addEventListener("click", toggle);
            resetButton.addEventListener("click", reset);
            closerButton.addEventListener("click", closer);
            furtherButton.addEventListener("click", further);
            document.addEventListener("visibilitychange", sync);
            reduced.addEventListener("change", sync);
            compiled = true;
            section.dataset.ready = "true";
            status.textContent = "";
            sizes.observe(stage);
            observer.observe(stage);
            sync();
        } catch {
            teardown?.();
            if (!teardown) renderer?.dispose();
            cleanup = undefined;
            section.dataset.state = "unavailable";
            status.textContent =
                "The 3D model could not be loaded. You can still read the project below.";
            retryButton.hidden = false;
        } finally {
            loading = false;
            if (ticket !== generation && active) void initialize();
        }
    };
    retryButton.addEventListener("click", () => void initialize());
    const observer = new IntersectionObserver(
        ([entry]) => {
            if (entry.isIntersecting) {
                observer.disconnect();
                void initialize();
            }
        },
        { rootMargin: "200px" },
    );
    observer.observe(stage);
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
            observer.observe(stage);
        }
    });
}
