import type * as Three from "three";

const section = document.querySelector<HTMLElement>(".experience-visual");
const start = section?.querySelector<HTMLButtonElement>(
    "[data-experience-start]",
);
const stage = section?.querySelector<HTMLElement>("[data-experience-stage]");
const status = section?.querySelector<HTMLElement>("[data-experience-status]");
const controlsPanel = section?.querySelector<HTMLElement>(
    "[data-experience-controls]",
);
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
const worlds = [
    ...(section?.querySelectorAll<HTMLButtonElement>(
        "[data-experience-world]",
    ) ?? []),
];
type World = "earth" | "moon" | "mars" | "jupiter" | "saturn";
const names: Record<World, string> = {
    earth: "Earth",
    moon: "Moon",
    mars: "Mars",
    jupiter: "Jupiter",
    saturn: "Saturn",
};

if (
    start &&
    stage &&
    status &&
    controlsPanel &&
    motionButton &&
    resetButton &&
    current
) {
    let cleanup: (() => void) | undefined;
    let loading = false;
    let paused = false;
    start.addEventListener("click", async () => {
        if (cleanup) {
            cleanup();
            cleanup = undefined;
            return;
        }
        if (loading) return;
        loading = true;
        start.disabled = true;
        status.textContent = "Loading the orbital visual…";
        let renderer: Three.WebGLRenderer | undefined;
        try {
            const THREE = await import("three");
            const { OrbitControls } =
                await import("three/addons/controls/OrbitControls.js");
            renderer = new THREE.WebGLRenderer({
                antialias: true,
                powerPreference: "high-performance",
            });
            const render = renderer;
            render.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
            render.outputColorSpace = THREE.SRGBColorSpace;
            render.toneMapping = THREE.ACESFilmicToneMapping;
            render.toneMappingExposure = 1.15;
            render.setClearColor(0x030609);
            render.shadowMap.enabled = true;
            render.shadowMap.type = THREE.PCFSoftShadowMap;
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 200);
            camera.position.set(0, 0.35, 4.8);
            const orbit = new OrbitControls(camera, render.domElement);
            orbit.enableDamping = true;
            orbit.dampingFactor = 0.08;
            orbit.enablePan = false;
            orbit.minDistance = 2.2;
            orbit.maxDistance = 14;
            orbit.rotateSpeed = 0.6;
            orbit.zoomSpeed = 0.7;
            const sun = new THREE.DirectionalLight(0xfff1dc, 3.2);
            sun.position.set(-4, 2.4, 4);
            sun.castShadow = true;
            sun.shadow.mapSize.set(1024, 1024);
            sun.shadow.camera.left = -3;
            sun.shadow.camera.right = 3;
            sun.shadow.camera.top = 3;
            sun.shadow.camera.bottom = -3;
            sun.shadow.bias = -0.0002;
            scene.add(sun);
            scene.add(new THREE.AmbientLight(0x8899bb, 0.09));
            const loader = new THREE.TextureLoader();
            const small =
                matchMedia("(max-width: 700px)").matches ||
                ((navigator as Navigator & { deviceMemory?: number })
                    .deviceMemory !== undefined &&
                    (navigator as Navigator & { deviceMemory?: number })
                        .deviceMemory! <= 4);
            const texture = async (name: string, color = true) => {
                const t = await loader.loadAsync(
                    `/images/trajectory/${name}.webp`,
                );
                if (color) t.colorSpace = THREE.SRGBColorSpace;
                t.anisotropy = Math.min(
                    4,
                    render.capabilities.getMaxAnisotropy(),
                );
                return t;
            };
            const owned = new Set<Three.Texture>();
            const textureCache = new Map<string, Promise<Three.Texture>>();
            let disposed = false;
            const getTexture = (name: string, color = true) => {
                let promise = textureCache.get(name);
                if (!promise) {
                    promise = texture(name, color)
                        .then((t) => {
                            if (disposed) t.dispose();
                            else owned.add(t);
                            return t;
                        })
                        .catch((error) => {
                            textureCache.delete(name);
                            throw error;
                        });
                    textureCache.set(name, promise);
                }
                return promise;
            };
            const stars = new Float32Array(600 * 3);
            let seed = 32517;
            const random = () => {
                seed = (seed * 16807) % 2147483647;
                return (seed - 1) / 2147483646;
            };
            for (let i = 0; i < stars.length; i += 3) {
                const y = random() * 2 - 1,
                    a = random() * Math.PI * 2,
                    r = Math.sqrt(1 - y * y) * 60;
                stars[i] = Math.cos(a) * r;
                stars[i + 1] = y * 60;
                stars[i + 2] = Math.sin(a) * r;
            }
            const starsGeometry = new THREE.BufferGeometry();
            starsGeometry.setAttribute(
                "position",
                new THREE.BufferAttribute(stars, 3),
            );
            const starsMaterial = new THREE.PointsMaterial({
                color: 0xc8d0d4,
                size: 0.055,
                sizeAttenuation: true,
            });
            scene.add(new THREE.Points(starsGeometry, starsMaterial));
            const root = new THREE.Group();
            scene.add(root);
            let active: Three.Group | undefined,
                activeWorld: World = "earth",
                version = 0,
                visible = true,
                frame = 0;
            const motion = matchMedia("(prefers-reduced-motion: reduce)");
            const disposeObject = (object: Three.Object3D) => {
                object.traverse((item) => {
                    const mesh = item as Three.Mesh;
                    mesh.geometry?.dispose();
                    const materials = Array.isArray(mesh.material)
                        ? mesh.material
                        : mesh.material
                          ? [mesh.material]
                          : [];
                    materials.forEach((m) => m.dispose());
                });
            };
            const resize = () => {
                const w = stage.clientWidth,
                    h = stage.clientHeight;
                if (!w || !h) return;
                render.setSize(w, h, false);
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
                if (activeWorld === "saturn") {
                    const minimum = Math.min(
                        13,
                        2.35 /
                            (Math.tan(
                                THREE.MathUtils.degToRad(camera.fov / 2),
                            ) *
                                Math.min(1, camera.aspect)),
                    );
                    const offset = camera.position.clone().sub(orbit.target);
                    if (offset.length() < minimum)
                        camera.position
                            .copy(orbit.target)
                            .add(offset.setLength(minimum));
                }
                orbit.update();
                render.render(scene, camera);
            };
            const draw = () => {
                frame = 0;
                if (disposed || !visible || document.hidden) return;
                orbit.autoRotate = !paused && !motion.matches;
                orbit.autoRotateSpeed = 0.24;
                orbit.update();
                render.render(scene, camera);
                if (!paused && !motion.matches)
                    frame = requestAnimationFrame(draw);
            };
            const wake = () => {
                if (!frame && visible && !document.hidden && !disposed) draw();
            };
            const reset = () => {
                const distance =
                    activeWorld === "saturn"
                        ? Math.min(
                              13,
                              2.35 /
                                  (Math.tan(
                                      THREE.MathUtils.degToRad(camera.fov / 2),
                                  ) *
                                      Math.min(1, camera.aspect)),
                          )
                        : 4.8;
                const elevation = activeWorld === "saturn" ? 0.34 : 0.073;
                camera.position.set(
                    0,
                    Math.sin(elevation) * distance,
                    Math.cos(elevation) * distance,
                );
                orbit.target.set(0, 0, 0);
                orbit.update();
                render.render(scene, camera);
            };
            const syncMotion = () => {
                orbit.enableDamping = !paused && !motion.matches;
                motionButton.disabled = motion.matches;
                motionButton.textContent = motion.matches
                    ? "Motion reduced by system"
                    : paused
                      ? "Resume motion"
                      : "Pause motion";
                if ((paused || motion.matches) && frame) {
                    cancelAnimationFrame(frame);
                    frame = 0;
                }
                wake();
            };
            const toggleMotion = () => {
                paused = !paused;
                syncMotion();
            };
            const loadWorld = async (world: World) => {
                const ticket = ++version;
                status.textContent = `Loading ${names[world]}…`;
                const group = new THREE.Group();
                try {
                    const suffix = small ? "1k" : "2k";
                    const file =
                        world === "moon"
                            ? "moon-1k"
                            : world === "saturn"
                              ? "saturn-strip-v1"
                              : `${world}-${suffix}`;
                    const map = await getTexture(file);
                    const surface = new THREE.Mesh(
                        new THREE.SphereGeometry(1, 96, 64),
                        new THREE.MeshStandardMaterial({
                            map,
                            roughness: 0.92,
                            metalness: 0,
                        }),
                    );
                    surface.castShadow = world === "saturn";
                    surface.receiveShadow = world === "saturn";
                    group.add(surface);
                    if (world === "earth") {
                        const [clouds, night] = await Promise.all([
                            getTexture(`earth-clouds-${suffix}`, false),
                            getTexture("earth-night-2k"),
                        ]);
                        const cloud = new THREE.Mesh(
                            new THREE.SphereGeometry(1.008, 96, 64),
                            new THREE.MeshStandardMaterial({
                                color: 0xffffff,
                                alphaMap: clouds,
                                transparent: true,
                                opacity: 0.7,
                                depthWrite: false,
                                roughness: 1,
                            }),
                        );
                        group.add(cloud);
                        const nightMat = new THREE.ShaderMaterial({
                            uniforms: {
                                nightMap: { value: night },
                                sunDirection: {
                                    value: new THREE.Vector3(
                                        -4,
                                        2.4,
                                        4,
                                    ).normalize(),
                                },
                            },
                            vertexShader: `varying vec2 vUv; varying vec3 vNormalWorld; void main(){vUv=uv; vNormalWorld=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
                            fragmentShader: `uniform sampler2D nightMap; uniform vec3 sunDirection; varying vec2 vUv; varying vec3 vNormalWorld; void main(){float n=1.0-smoothstep(-0.18,0.16,dot(normalize(vNormalWorld),sunDirection)); vec3 c=texture2D(nightMap,vUv).rgb; gl_FragColor=vec4(c*vec3(1.0,0.69,0.38)*n,1.0);}`,
                            blending: THREE.AdditiveBlending,
                            transparent: true,
                            depthWrite: false,
                        });
                        group.add(
                            new THREE.Mesh(
                                new THREE.SphereGeometry(1.002, 96, 64),
                                nightMat,
                            ),
                        );
                        const atmosphere = new THREE.ShaderMaterial({
                            uniforms: {},
                            vertexShader: `varying vec3 vN; varying vec3 vV; void main(){vec4 p=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-p.xyz); gl_Position=projectionMatrix*p;}`,
                            fragmentShader: `varying vec3 vN; varying vec3 vV; void main(){float rim=pow(1.0-abs(dot(normalize(vN),normalize(vV))),3.5); gl_FragColor=vec4(0.24,0.52,0.88,rim*0.35);}`,
                            transparent: true,
                            blending: THREE.AdditiveBlending,
                            depthWrite: false,
                            side: THREE.FrontSide,
                        });
                        group.add(
                            new THREE.Mesh(
                                new THREE.SphereGeometry(1.035, 96, 64),
                                atmosphere,
                            ),
                        );
                    }
                    if (world === "saturn") {
                        const ringMap = await getTexture("saturn-ring-1k");
                        const geometry = new THREE.RingGeometry(
                            1.25,
                            2.15,
                            160,
                            1,
                        );
                        const pos = geometry.attributes.position,
                            uv = geometry.attributes.uv;
                        for (let i = 0; i < pos.count; i++) {
                            const radius = Math.hypot(pos.getX(i), pos.getY(i));
                            uv.setXY(i, (radius - 1.25) / 0.9, 0.5);
                        }
                        const rings = new THREE.Mesh(
                            geometry,
                            new THREE.MeshStandardMaterial({
                                map: ringMap,
                                transparent: true,
                                side: THREE.DoubleSide,
                                roughness: 1,
                                depthWrite: true,
                                alphaTest: 0.08,
                            }),
                        );
                        rings.rotation.x = Math.PI / 2;
                        rings.castShadow = true;
                        rings.receiveShadow = true;
                        group.add(rings);
                        group.rotation.z = 0.22;
                    }
                    if (disposed || ticket !== version) {
                        disposeObject(group);
                        return;
                    }
                    if (active) {
                        root.remove(active);
                        disposeObject(active);
                    }
                    active = group;
                    root.add(group);
                    activeWorld = world;
                    worlds.forEach((button) =>
                        button.setAttribute(
                            "aria-pressed",
                            String(button.dataset.experienceWorld === world),
                        ),
                    );
                    current.textContent = names[world];
                    stage.dataset.world = world;
                    status.textContent = "";
                    reset();
                    if (poster) poster.hidden = true;
                    start.hidden = false;
                    wake();
                } catch {
                    disposeObject(group);
                    if (!disposed && ticket === version) {
                        if (!active) {
                            cleanup?.();
                            cleanup = undefined;
                            start.hidden = false;
                            start.textContent = "Try again";
                        }
                        status.textContent = `Could not load ${names[world]}. Please try again.`;
                    }
                }
            };
            const key = (event: KeyboardEvent) => {
                const step = 0.16;
                if (event.key === "Home") {
                    event.preventDefault();
                    reset();
                    return;
                }
                const v = camera.position.clone().sub(orbit.target);
                const s = new THREE.Spherical().setFromVector3(v);
                if (event.key === "ArrowLeft") s.theta -= step;
                else if (event.key === "ArrowRight") s.theta += step;
                else if (event.key === "ArrowUp")
                    s.phi = Math.max(0.1, s.phi - step);
                else if (event.key === "ArrowDown")
                    s.phi = Math.min(Math.PI - 0.1, s.phi + step);
                else if (event.key === "+" || event.key === "=")
                    s.radius = Math.max(orbit.minDistance, s.radius * 0.85);
                else if (event.key === "-")
                    s.radius = Math.min(orbit.maxDistance, s.radius / 0.85);
                else return;
                event.preventDefault();
                camera.position.setFromSpherical(s).add(orbit.target);
                orbit.update();
                render.render(scene, camera);
            };
            const selections = worlds.map((button) => {
                const listener = () => {
                    const world = button.dataset.experienceWorld as World;
                    if (world in names) void loadWorld(world);
                };
                button.addEventListener("click", listener);
                return listener;
            });
            const observer = new IntersectionObserver((entries) => {
                visible = entries[0]?.isIntersecting ?? false;
                if (!visible && frame) {
                    cancelAnimationFrame(frame);
                    frame = 0;
                } else wake();
            });
            observer.observe(stage);
            const ro = new ResizeObserver(resize);
            ro.observe(stage);
            const changed = () => {
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
                render.render(scene, camera);
            };
            const lost = (e: Event) => {
                e.preventDefault();
                cleanup?.();
                cleanup = undefined;
                status.textContent =
                    "The visual is unavailable. The experience record remains below.";
            };
            orbit.addEventListener("change", changed);
            stage.addEventListener("keydown", key);
            render.domElement.addEventListener("webglcontextlost", lost);
            document.addEventListener("visibilitychange", wake);
            motion.addEventListener("change", syncMotion);
            motionButton.addEventListener("click", toggleMotion);
            resetButton.addEventListener("click", reset);
            cleanup = () => {
                disposed = true;
                version++;
                cancelAnimationFrame(frame);
                observer.disconnect();
                ro.disconnect();
                orbit.removeEventListener("change", changed);
                orbit.dispose();
                stage.removeEventListener("keydown", key);
                render.domElement.removeEventListener("webglcontextlost", lost);
                document.removeEventListener("visibilitychange", wake);
                motion.removeEventListener("change", syncMotion);
                motionButton.removeEventListener("click", toggleMotion);
                resetButton.removeEventListener("click", reset);
                worlds.forEach((button, i) =>
                    button.removeEventListener("click", selections[i]),
                );
                if (active) disposeObject(active);
                starsGeometry.dispose();
                starsMaterial.dispose();
                sun.shadow.dispose();
                owned.forEach((t) => t.dispose());
                render.dispose();
                render.domElement.remove();
                stage.hidden = true;
                controlsPanel.hidden = true;
                if (poster) poster.hidden = false;
                start.textContent = "Start exploring";
                status.textContent = "";
            };
            stage.hidden = false;
            stage.appendChild(render.domElement);
            controlsPanel.hidden = false;
            start.textContent = "Close visual";
            resize();
            syncMotion();
            await loadWorld("earth");
        } catch {
            renderer?.dispose();
            stage.hidden = true;
            controlsPanel.hidden = true;
            if (poster) poster.hidden = false;
            status.textContent =
                "The visual could not be loaded. The experience record remains below.";
            start.textContent = "Try again";
            start.hidden = false;
        } finally {
            loading = false;
            start.disabled = false;
        }
    });
    start.click();
    window.addEventListener("pagehide", () => {
        cleanup?.();
        cleanup = undefined;
    });
    window.addEventListener("pageshow", (event) => {
        if (event.persisted && !cleanup && !loading) start.click();
    });
}
