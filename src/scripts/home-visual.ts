import type * as Three from "three";
import type { HomeFraming } from "../lib/home-framing";

const wrapper = document.querySelector<HTMLElement>("[data-home-visual]");
const stage = wrapper?.querySelector<HTMLElement>("[data-home-stage]");
const poster = wrapper?.querySelector<HTMLElement>("[data-home-poster]");
const hero = wrapper?.closest<HTMLElement>(".home-hero");
const motionButton =
    document.querySelector<HTMLButtonElement>("[data-home-motion]");
const hint = document.querySelector<HTMLElement>("[data-home-hint]");

if (wrapper && stage && poster && hero) {
    let cleanup: (() => void) | undefined;
    let loading = false;
    let generation = 0;
    let pageActive = true;
    let paused = false;
    const initialize = async () => {
        if (cleanup || loading || !pageActive) return;
        loading = true;
        stage.dataset.reveal = "preparing";
        const ticket = ++generation;
        let renderer: Three.WebGLRenderer | undefined;
        let teardown: (() => void) | undefined;
        try {
            const [T, { makeHomeLandscape }] = await Promise.all([
                import("three"),
                import("./home-landscape"),
            ]);
            if (ticket !== generation || !pageActive) return;
            const render = new T.WebGLRenderer({
                antialias: true,
                alpha: false,
                powerPreference: "low-power",
            });
            renderer = render;
            // This Three.js renderer creates WebGL2 contexts exclusively.
            const gl = render.getContext() as WebGL2RenderingContext;
            render.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
            render.outputColorSpace = T.SRGBColorSpace;
            render.toneMapping = T.ACESFilmicToneMapping;
            render.toneMappingExposure = 1;
            render.shadowMap.enabled = true;
            render.shadowMap.type = T.PCFShadowMap;
            const landscape = makeHomeLandscape(render);
            let endLifetime: () => void = () => {};
            const lifetime = new Promise<void>((resolve) => {
                endLifetime = resolve;
            });
            let disposed = false,
                ready = false,
                revealed = false,
                frame = 0,
                visible = true;
            let lastTime = 0,
                revealFrame = 0,
                renderedWidth = 0,
                renderedHeight = 0;
            let reveal: Animation | undefined;
            let firstFrameFence: WebGLSync | null = null;
            const pointer = new T.Vector2(),
                current = new T.Vector2();
            const reduced = matchMedia("(prefers-reduced-motion: reduce)");
            const finePointer = matchMedia(
                "(hover: hover) and (pointer: fine)",
            );
            const updateButton = () => {
                if (!revealed) return;
                if (motionButton) {
                    motionButton.hidden = false;
                    motionButton.disabled = reduced.matches;
                    motionButton.textContent = reduced.matches
                        ? "Motion reduced by system"
                        : paused
                          ? "Resume motion"
                          : "Pause motion";
                    motionButton.setAttribute("aria-pressed", String(paused));
                }
                if (hint)
                    hint.hidden =
                        reduced.matches || paused || !finePointer.matches;
            };
            const draw = () => {
                render.render(landscape.scene, landscape.camera);
                // All objects and lights are static. Only the camera moves, so
                // one shadow pass is sufficient for the lifetime of the scene.
                render.shadowMap.autoUpdate = false;
            };
            const pose = () => {
                // Read the same media queries as <picture>, including portrait
                // tablets; aspect alone must not switch the camera composition.
                const source = Array.from(
                    poster.querySelectorAll("source"),
                ).find((item) => matchMedia(item.media).matches);
                const framing = (source?.dataset.homeFraming ??
                    "desktop") as HomeFraming;
                landscape.position(
                    wrapper.clientWidth,
                    wrapper.clientHeight,
                    framing,
                    current.x,
                    current.y,
                );
                stage.dataset.viewX = current.x.toFixed(4);
                stage.dataset.viewY = current.y.toFixed(4);
            };
            const tick = (time: number) => {
                frame = 0;
                if (disposed || !revealed || !visible || document.hidden) {
                    lastTime = 0;
                    return;
                }
                const still = reduced.matches || paused;
                // Camera easing follows elapsed time even on a slow renderer;
                // visibility changes reset the clock before it can jump.
                const delta = Math.min((time - (lastTime || time)) / 1000, 0.5);
                lastTime = time;
                stage.dataset.state = still ? "paused" : "running";
                if (!still && current.distanceToSquared(pointer) > 0.000001) {
                    current.lerp(pointer, 1 - Math.exp(-delta * 3.8));
                    pose();
                    draw();
                }
                // The image rests when the camera settles. Pointer movement
                // wakes it again without spending GPU time on unchanged frames.
                if (!still && current.distanceToSquared(pointer) > 0.000001)
                    frame = requestAnimationFrame(tick);
                else lastTime = 0;
            };
            const wake = () => {
                if (
                    !frame &&
                    revealed &&
                    visible &&
                    !document.hidden &&
                    !disposed
                )
                    frame = requestAnimationFrame(tick);
            };
            const sync = () => {
                cancelAnimationFrame(frame);
                frame = 0;
                lastTime = 0;
                if (reduced.matches && reveal?.playState === "running")
                    reveal.finish();
                updateButton();
                wake();
            };
            const resize = () => {
                if (
                    !ready ||
                    disposed ||
                    !stage.clientWidth ||
                    !stage.clientHeight
                )
                    return;
                if (
                    renderedWidth === stage.clientWidth &&
                    renderedHeight === stage.clientHeight
                )
                    return;
                renderedWidth = stage.clientWidth;
                renderedHeight = stage.clientHeight;
                render.setSize(renderedWidth, renderedHeight, false);
                pose();
                draw();
            };
            const onPointer = (event: PointerEvent) => {
                if (
                    event.pointerType !== "mouse" ||
                    !revealed ||
                    !finePointer.matches ||
                    reduced.matches ||
                    paused
                )
                    return;
                const rect = hero.getBoundingClientRect();
                pointer.set(
                    T.MathUtils.clamp(
                        ((event.clientX - rect.left) / rect.width - 0.5) * 2,
                        -1,
                        1,
                    ),
                    T.MathUtils.clamp(
                        (0.5 - (event.clientY - rect.top) / rect.height) * 2,
                        -1,
                        1,
                    ),
                );
                wake();
            };
            const leave = () => {
                pointer.set(0, 0);
                wake();
            };
            const toggle = () => {
                paused = !paused;
                sync();
            };
            const visibility = () => {
                if (document.hidden) {
                    cancelAnimationFrame(frame);
                    frame = 0;
                    lastTime = 0;
                    stage.dataset.state = "paused";
                } else wake();
            };
            const observer = new IntersectionObserver((items) => {
                visible = items[0]?.isIntersecting ?? false;
                if (!visible) {
                    cancelAnimationFrame(frame);
                    frame = 0;
                    lastTime = 0;
                    stage.dataset.state = "paused";
                } else wake();
            });
            const sizes = new ResizeObserver(resize);
            const lost = (event: Event) => {
                event.preventDefault();
                teardown?.();
                cleanup = undefined;
            };
            let previousMotion = reduced.matches;
            const preferenceTimer = window.setInterval(() => {
                if (!document.hidden && previousMotion !== reduced.matches) {
                    previousMotion = reduced.matches;
                    sync();
                }
            }, 500);
            motionButton?.addEventListener("click", toggle);
            hero.addEventListener("pointermove", onPointer, { passive: true });
            hero.addEventListener("pointerleave", leave);
            document.addEventListener("visibilitychange", visibility);
            reduced.addEventListener("change", sync);
            finePointer.addEventListener("change", sync);
            render.domElement.addEventListener("webglcontextlost", lost);
            teardown = () => {
                if (disposed) return;
                disposed = true;
                endLifetime();
                cancelAnimationFrame(frame);
                cancelAnimationFrame(revealFrame);
                reveal?.cancel();
                if (firstFrameFence) gl.deleteSync(firstFrameFence);
                firstFrameFence = null;
                clearInterval(preferenceTimer);
                observer.disconnect();
                sizes.disconnect();
                motionButton?.removeEventListener("click", toggle);
                hero.removeEventListener("pointermove", onPointer);
                hero.removeEventListener("pointerleave", leave);
                document.removeEventListener("visibilitychange", visibility);
                reduced.removeEventListener("change", sync);
                finePointer.removeEventListener("change", sync);
                render.domElement.removeEventListener("webglcontextlost", lost);
                landscape.dispose();
                render.dispose();
                render.domElement.remove();
                stage.hidden = true;
                poster.hidden = false;
                stage.dataset.state = "paused";
                stage.dataset.reveal = "poster";
                delete stage.dataset.artwork;
                if (motionButton) motionButton.hidden = true;
                if (hint) hint.hidden = true;
            };
            cleanup = teardown;
            await Promise.race([
                Promise.all([landscape.ready, document.fonts.ready]),
                lifetime,
            ]);
            if (disposed || ticket !== generation || !pageActive) {
                teardown();
                return;
            }
            pose();
            await Promise.race([
                render.compileAsync(landscape.scene, landscape.camera),
                lifetime,
            ]);
            if (disposed || ticket !== generation || !pageActive) {
                teardown();
                return;
            }
            ready = true;
            stage.appendChild(render.domElement);
            stage.hidden = false;
            resize();
            sizes.observe(stage);
            // Keep the still visible until the GPU has drawn the complete first
            // frame, including shadows and textures. Shader compilation alone
            // does not guarantee that the canvas is ready to show.
            firstFrameFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
            gl.flush();
            const painted = new Promise<void>((resolve, reject) => {
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
                        reject(new Error("First frame unavailable"));
                    else resolve();
                };
                revealFrame = requestAnimationFrame(check);
            });
            await Promise.race([painted, lifetime]);
            if (
                disposed ||
                ticket !== generation ||
                !pageActive ||
                gl.isContextLost()
            ) {
                teardown();
                return;
            }
            stage.dataset.reveal = "fading";
            if (!reduced.matches) {
                reveal = stage.animate([{ opacity: 0 }, { opacity: 1 }], {
                    duration: 900,
                    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
                    fill: "forwards",
                });
                await Promise.race([reveal.finished.catch(() => {}), lifetime]);
            }
            if (disposed || ticket !== generation || !pageActive) {
                teardown();
                return;
            }
            stage.dataset.reveal = "ready";
            reveal?.cancel();
            poster.hidden = true;
            revealed = true;
            stage.dataset.artwork = "rover-3d";
            observer.observe(stage);
            sync();
        } catch {
            teardown?.();
            renderer?.dispose();
            cleanup = undefined;
            stage.hidden = true;
            poster.hidden = false;
            stage.dataset.state = "error";
            stage.dataset.reveal = "poster";
            if (motionButton) motionButton.hidden = true;
            if (hint) hint.hidden = true;
        } finally {
            loading = false;
            if (ticket !== generation && pageActive) void initialize();
        }
    };
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
