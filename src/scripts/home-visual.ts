import type * as Three from "three";

// Blender supplies the lighting and terrain. This small depth pass adds a quiet
// camera drift without replacing the finished composition with a different scene.
const wrapper = document.querySelector<HTMLElement>("[data-home-visual]");
const stage = wrapper?.querySelector<HTMLElement>("[data-home-stage]");
const poster = wrapper?.querySelector<HTMLElement>("[data-home-poster]");
const photograph = poster?.querySelector<HTMLImageElement>("img");
const motionButton =
    document.querySelector<HTMLButtonElement>("[data-home-motion]");

if (wrapper && stage && poster && photograph) {
    let cleanup: (() => void) | undefined;
    let loading = false;
    let generation = 0;
    let pageActive = true;
    let paused = false;
    const initialize = async () => {
        if (cleanup || loading) return;
        loading = true;
        const ticket = ++generation;
        let renderer: Three.WebGLRenderer | undefined;
        const resources: Three.Texture[] = [];
        try {
            await photograph.decode();
            const T = await import("three");
            if (ticket !== generation) return;
            const render = new T.WebGLRenderer({
                antialias: false,
                alpha: false,
                powerPreference: "low-power",
            });
            renderer = render;
            render.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
            render.outputColorSpace = T.SRGBColorSpace;
            const loader = new T.TextureLoader();
            const mobile = matchMedia("(max-width: 650px)");
            const source = await loader.loadAsync(photograph.currentSrc);
            resources.push(source);
            source.colorSpace = T.SRGBColorSpace;
            const depth = await loader.loadAsync(
                mobile.matches
                    ? "/images/scenes/horizon-depth-mobile-v1.webp"
                    : "/images/scenes/horizon-depth-v1.webp",
            );
            resources.push(depth);
            if (ticket !== generation) {
                resources.forEach((t) => t.dispose());
                render.dispose();
                return;
            }
            const scene = new T.Scene();
            const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 2);
            camera.position.z = 1;
            const uniforms = {
                sceneImage: { value: source },
                depthImage: { value: depth },
                crop: { value: new T.Vector2(1, 1) },
                shift: { value: new T.Vector2(0, 0) },
                center: { value: new T.Vector2(0.5, 0.5) },
            };
            const material = new T.ShaderMaterial({
                uniforms,
                vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.);}`,
                fragmentShader: `uniform sampler2D sceneImage,depthImage;uniform vec2 crop,shift,center;varying vec2 vUv;
                void main(){vec2 uv=(vUv-.5)*crop*.986+center;float depth=texture2D(depthImage,uv).r;uv+=shift*(.3+(1.-depth)*.7);gl_FragColor=vec4(texture2D(sceneImage,clamp(uv,vec2(.001),vec2(.999))).rgb,1.);
                #include <colorspace_fragment>
                }`,
                depthTest: false,
                depthWrite: false,
            });
            const geometry = new T.PlaneGeometry(2, 2);
            scene.add(new T.Mesh(geometry, material));
            stage.appendChild(render.domElement);
            stage.hidden = false;
            let disposed = false,
                frame = 0,
                visible = true,
                elapsed = 0,
                lastTime = 0;
            const pointer = new T.Vector2(),
                drift = new T.Vector2();
            const reduced = matchMedia("(prefers-reduced-motion: reduce)");
            const updateButton = () => {
                if (!motionButton) return;
                motionButton.hidden = false;
                motionButton.disabled = reduced.matches;
                motionButton.textContent = reduced.matches
                    ? "Motion reduced by system"
                    : paused
                      ? "Resume motion"
                      : "Pause motion";
                motionButton.setAttribute("aria-pressed", String(paused));
            };
            const draw = () => render.render(scene, camera);
            const tick = (time: number) => {
                frame = 0;
                if (disposed || !visible || document.hidden) {
                    lastTime = 0;
                    return;
                }
                updateButton();
                const still = reduced.matches || paused;
                stage.dataset.state = still ? "paused" : "running";
                if (!still) {
                    const delta = Math.min(
                        (time - (lastTime || time)) / 1000,
                        0.1,
                    );
                    elapsed += delta;
                    lastTime = time;
                    drift.set(
                        Math.sin(elapsed * 0.12) * 0.003 + pointer.x * 0.002,
                        Math.cos(elapsed * 0.09) * 0.0015 + pointer.y * 0.001,
                    );
                    uniforms.shift.value.lerp(drift, 1 - Math.exp(-delta * 3));
                } else lastTime = 0;
                draw();
                if (!still) frame = requestAnimationFrame(tick);
            };
            const wake = () => {
                if (!frame && visible && !document.hidden && !disposed)
                    frame = requestAnimationFrame(tick);
            };
            const sync = () => {
                if (frame) cancelAnimationFrame(frame);
                frame = 0;
                updateButton();
                wake();
            };
            const resize = () => {
                const width = stage.clientWidth,
                    height = stage.clientHeight;
                if (!width || !height) return;
                render.setSize(width, height, false);
                const aspect = width / height,
                    imageAspect =
                        photograph.naturalWidth / photograph.naturalHeight;
                uniforms.crop.value.set(
                    Math.min(1, aspect / imageAspect),
                    Math.min(1, imageAspect / aspect),
                );
                uniforms.center.value.set(
                    0.5 + (1 - uniforms.crop.value.x) * 0.22,
                    0.5,
                );
                draw();
            };
            const onPointer = (event: PointerEvent) => {
                if (event.pointerType !== "mouse" || reduced.matches || paused)
                    return;
                const rect = stage.getBoundingClientRect();
                pointer.set(
                    (event.clientX - rect.left) / rect.width - 0.5,
                    0.5 - (event.clientY - rect.top) / rect.height,
                );
            };
            const toggle = () => {
                paused = !paused;
                sync();
            };
            const visibility = () => {
                if (document.hidden) {
                    if (frame) cancelAnimationFrame(frame);
                    frame = 0;
                    lastTime = 0;
                    stage.dataset.state = "paused";
                } else wake();
            };
            const observer = new IntersectionObserver((items) => {
                visible = items[0]?.isIntersecting ?? false;
                if (!visible) {
                    if (frame) cancelAnimationFrame(frame);
                    frame = 0;
                    lastTime = 0;
                    stage.dataset.state = "paused";
                } else wake();
            });
            observer.observe(stage);
            const sizes = new ResizeObserver(resize);
            sizes.observe(stage);
            const lost = (event: Event) => {
                event.preventDefault();
                cleanup?.();
                cleanup = undefined;
            };
            const responsive = () => {
                cleanup?.();
                cleanup = undefined;
                void initialize();
            };
            let previousMotion = reduced.matches;
            const preferenceTimer = window.setInterval(() => {
                if (!document.hidden && previousMotion !== reduced.matches) {
                    previousMotion = reduced.matches;
                    sync();
                }
            }, 500);
            motionButton?.addEventListener("click", toggle);
            window.addEventListener("pointermove", onPointer, {
                passive: true,
            });
            document.addEventListener("visibilitychange", visibility);
            reduced.addEventListener("change", sync);
            mobile.addEventListener("change", responsive);
            render.domElement.addEventListener("webglcontextlost", lost);
            cleanup = () => {
                disposed = true;
                cancelAnimationFrame(frame);
                clearInterval(preferenceTimer);
                observer.disconnect();
                sizes.disconnect();
                motionButton?.removeEventListener("click", toggle);
                window.removeEventListener("pointermove", onPointer);
                document.removeEventListener("visibilitychange", visibility);
                reduced.removeEventListener("change", sync);
                mobile.removeEventListener("change", responsive);
                render.domElement.removeEventListener("webglcontextlost", lost);
                geometry.dispose();
                material.dispose();
                resources.forEach((t) => t.dispose());
                render.dispose();
                render.domElement.remove();
                stage.hidden = true;
                poster.hidden = false;
                stage.dataset.state = "paused";
                if (motionButton) motionButton.hidden = true;
            };
            resize();
            poster.hidden = true;
            stage.dataset.artwork = "blender";
            sync();
        } catch {
            cleanup?.();
            cleanup = undefined;
            resources.forEach((t) => t.dispose());
            renderer?.dispose();
            stage.hidden = true;
            poster.hidden = false;
            stage.dataset.state = "error";
            if (motionButton) motionButton.hidden = true;
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
