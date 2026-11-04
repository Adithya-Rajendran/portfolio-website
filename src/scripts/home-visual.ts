import type * as Three from "three";

const wrapper = document.querySelector<HTMLElement>("[data-home-visual]");
const stage = wrapper?.querySelector<HTMLElement>("[data-home-stage]");
const motionButton =
    document.querySelector<HTMLButtonElement>("[data-home-motion]");
const poster = wrapper?.querySelector<HTMLElement>("[data-home-poster]");

if (wrapper && stage) {
    let cleanup: (() => void) | undefined;
    let loading = false;
    let generation = 0;
    let pageActive = true;
    const initialize = async () => {
        if (cleanup || loading) return;
        loading = true;
        const ticket = ++generation;
        let renderer: Three.WebGLRenderer | undefined;
        try {
            const T = await import("three");
            const { RoundedBoxGeometry } =
                await import("three/addons/geometries/RoundedBoxGeometry.js");
            if (ticket !== generation) return;
            const render = new T.WebGLRenderer({
                antialias: true,
                alpha: false,
                powerPreference: "high-performance",
            });
            renderer = render;
            render.setPixelRatio(Math.min(devicePixelRatio || 1, 1.35));
            render.outputColorSpace = T.SRGBColorSpace;
            render.toneMapping = T.ACESFilmicToneMapping;
            render.toneMappingExposure = 1.2;
            render.shadowMap.enabled = true;
            render.shadowMap.type = T.PCFSoftShadowMap;
            const scene = new T.Scene();
            const skyCanvas = document.createElement("canvas");
            skyCanvas.width = 1024;
            skyCanvas.height = 512;
            const sky = skyCanvas.getContext("2d");
            if (!sky) throw new Error("Sky unavailable");
            const gradient = sky.createLinearGradient(0, 0, 0, 512);
            gradient.addColorStop(0, "#0a1016");
            gradient.addColorStop(0.12, "#17171a");
            gradient.addColorStop(0.25, "#694335");
            gradient.addColorStop(0.32, "#c88257");
            gradient.addColorStop(0.42, "#45302c");
            gradient.addColorStop(1, "#211b1b");
            sky.fillStyle = gradient;
            sky.fillRect(0, 0, 1024, 512);
            const glow = sky.createRadialGradient(650, 164, 2, 650, 164, 160);
            glow.addColorStop(0, "rgba(255,213,151,.95)");
            glow.addColorStop(0.05, "rgba(244,156,92,.65)");
            glow.addColorStop(1, "rgba(244,156,92,0)");
            sky.fillStyle = glow;
            sky.fillRect(0, 0, 1024, 512);
            const skyTexture = new T.CanvasTexture(skyCanvas);
            skyTexture.colorSpace = T.SRGBColorSpace;
            scene.background = skyTexture;
            scene.fog = new T.FogExp2(0x49342c, 0.011);
            const camera = new T.PerspectiveCamera(34, 1, 0.1, 180);
            const setCamera = () => {
                const mobile = stage.clientWidth < 700;
                camera.position.set(
                    mobile ? 6.1 : 7.4,
                    mobile ? 3.4 : 4.0,
                    mobile ? 9.5 : 11.5,
                );
                camera.lookAt(mobile ? 1.0 : -1.25, 1.35, 0);
            };
            setCamera();
            scene.add(new T.HemisphereLight(0xd8d1bf, 0x634838, 1.8));
            const sun = new T.DirectionalLight(0xffc083, 3.0);
            sun.position.set(-14, 4, -12);
            sun.castShadow = true;
            sun.shadow.mapSize.set(1024, 1024);
            sun.shadow.camera.left = -12;
            sun.shadow.camera.right = 12;
            sun.shadow.camera.top = 12;
            sun.shadow.camera.bottom = -12;
            sun.shadow.bias = -0.0003;
            scene.add(sun);
            const fill = new T.DirectionalLight(0xa9c5dc, 2.1);
            fill.position.set(7, 5, 10);
            scene.add(fill);
            const materials = {
                hull: new T.MeshStandardMaterial({
                    color: 0xb9b4a1,
                    roughness: 0.72,
                    metalness: 0.25,
                }),
                panel: new T.MeshStandardMaterial({
                    color: 0x6c7966,
                    roughness: 0.8,
                    metalness: 0.25,
                }),
                dark: new T.MeshStandardMaterial({
                    color: 0x25292a,
                    roughness: 0.8,
                    metalness: 0.3,
                }),
                metal: new T.MeshStandardMaterial({
                    color: 0x77776e,
                    roughness: 0.52,
                    metalness: 0.7,
                }),
                rubber: new T.MeshStandardMaterial({
                    color: 0x282524,
                    roughness: 1,
                }),
                lens: new T.MeshStandardMaterial({
                    color: 0x182a35,
                    roughness: 0.17,
                    metalness: 0.75,
                }),
                accent: new T.MeshStandardMaterial({
                    color: 0xdfa05d,
                    roughness: 0.6,
                    metalness: 0.2,
                }),
                rock: new T.MeshStandardMaterial({
                    color: 0x705044,
                    roughness: 1,
                }),
            };
            const rover = new T.Group();
            scene.add(rover);
            rover.position.set(1.4, 0, 0);
            rover.rotation.y = -0.22;
            const box = (
                parent: Three.Object3D,
                size: [number, number, number],
                position: [number, number, number],
                material: Three.Material,
                bevel = false,
            ) => {
                const geometry = bevel
                    ? new RoundedBoxGeometry(
                          ...size,
                          3,
                          Math.min(...size) * 0.12,
                      )
                    : new T.BoxGeometry(...size);
                const mesh = new T.Mesh(geometry, material);
                mesh.position.set(...position);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                parent.add(mesh);
                return mesh;
            };
            const cylinder = (
                parent: Three.Object3D,
                radius: number,
                length: number,
                pos: [number, number, number],
                mat: Three.Material,
                axis: "x" | "y" | "z" = "y",
            ) => {
                const mesh = new T.Mesh(
                    new T.CylinderGeometry(radius, radius, length, 24),
                    mat,
                );
                mesh.position.set(...pos);
                if (axis === "x") mesh.rotation.z = Math.PI / 2;
                if (axis === "z") mesh.rotation.x = Math.PI / 2;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                parent.add(mesh);
                return mesh;
            };
            const beam = (
                parent: Three.Object3D,
                a: Three.Vector3,
                b: Three.Vector3,
                radius: number,
                mat: Three.Material,
            ) => {
                const delta = b.clone().sub(a);
                const mesh = new T.Mesh(
                    new T.CylinderGeometry(radius, radius, delta.length(), 12),
                    mat,
                );
                mesh.position.copy(a).add(b).multiplyScalar(0.5);
                mesh.quaternion.setFromUnitVectors(
                    new T.Vector3(0, 1, 0),
                    delta.normalize(),
                );
                mesh.castShadow = true;
                parent.add(mesh);
                return mesh;
            };
            box(rover, [3.1, 0.72, 1.85], [0, 1.42, 0], materials.hull, true);
            box(rover, [2.35, 0.16, 1.65], [-0.05, 1.86, 0], materials.panel);
            box(rover, [2.7, 0.16, 1.72], [0, 1.02, 0], materials.dark);
            for (const z of [-0.94, 0.94]) {
                box(rover, [2.75, 0.17, 0.08], [0, 1.45, z], materials.dark);
                for (const x of [-1.05, 0, 1.05]) {
                    const wheelZ = z * 1.33;
                    beam(
                        rover,
                        new T.Vector3(x * 0.65, 1.05, z * 0.75),
                        new T.Vector3(x, 0.55, wheelZ),
                        0.075,
                        materials.metal,
                    );
                    cylinder(
                        rover,
                        0.53,
                        0.37,
                        [x, 0.53, wheelZ],
                        materials.rubber,
                        "z",
                    );
                    cylinder(
                        rover,
                        0.32,
                        0.385,
                        [x, 0.53, wheelZ + Math.sign(z) * 0.014],
                        materials.metal,
                        "z",
                    );
                    cylinder(
                        rover,
                        0.13,
                        0.41,
                        [x, 0.53, wheelZ + Math.sign(z) * 0.025],
                        materials.dark,
                        "z",
                    );
                    const tread = new T.InstancedMesh(
                        new T.BoxGeometry(0.16, 0.08, 0.4),
                        materials.dark,
                        20,
                    );
                    const matrix = new T.Matrix4(),
                        q = new T.Quaternion(),
                        scale = new T.Vector3(1, 1, 1);
                    for (let i = 0; i < 20; i++) {
                        const angle = (i * Math.PI * 2) / 20;
                        q.setFromAxisAngle(new T.Vector3(0, 0, 1), -angle);
                        matrix.compose(
                            new T.Vector3(
                                x + Math.sin(angle) * 0.52,
                                0.53 + Math.cos(angle) * 0.52,
                                wheelZ,
                            ),
                            q,
                            scale,
                        );
                        tread.setMatrixAt(i, matrix);
                    }
                    tread.castShadow = true;
                    rover.add(tread);
                    for (let i = 0; i < 8; i++) {
                        const a = (i * Math.PI) / 4;
                        cylinder(
                            rover,
                            0.025,
                            0.43,
                            [
                                x + Math.sin(a) * 0.23,
                                0.53 + Math.cos(a) * 0.23,
                                wheelZ,
                            ],
                            materials.dark,
                            "z",
                        );
                    }
                }
                beam(
                    rover,
                    new T.Vector3(-1.05, 0.66, z * 1.18),
                    new T.Vector3(1.05, 0.66, z * 1.18),
                    0.06,
                    materials.dark,
                );
            }
            // Equipment deck, fasteners, and a stereo navigation head.
            box(rover, [1.0, 0.26, 1.0], [-0.5, 2.06, 0], materials.dark);
            for (let i = 0; i < 6; i++)
                box(
                    rover,
                    [0.09, 0.02, 0.85],
                    [-0.87 + i * 0.15, 2.2, 0],
                    materials.metal,
                );
            cylinder(rover, 0.16, 1.25, [0.8, 2.53, -0.2], materials.metal);
            cylinder(rover, 0.24, 0.16, [0.8, 2.0, -0.2], materials.dark);
            const mast = new T.Group();
            mast.position.set(0.8, 3.18, -0.2);
            rover.add(mast);
            box(mast, [1.02, 0.4, 0.4], [0, 0, 0], materials.hull, true);
            for (const x of [-0.28, 0.28]) {
                cylinder(mast, 0.145, 0.1, [x, 0, 0.24], materials.dark, "z");
                cylinder(mast, 0.105, 0.11, [x, 0, 0.26], materials.lens, "z");
            }
            for (const x of [-0.28, 0.28]) {
                const reflection = new T.Mesh(
                    new T.SphereGeometry(0.025, 12, 8),
                    new T.MeshBasicMaterial({ color: 0x9bdbd3 }),
                );
                reflection.position.set(x - 0.035, 0.035, 0.32);
                mast.add(reflection);
            }
            const indicatorMaterial = new T.MeshBasicMaterial({
                color: 0xdfa05d,
            });
            cylinder(
                rover,
                0.035,
                0.03,
                [0.7, 1.65, 0.99],
                indicatorMaterial,
                "z",
            );
            cylinder(
                rover,
                0.035,
                0.03,
                [0.83, 1.65, 0.99],
                new T.MeshBasicMaterial({ color: 0x8aba80 }),
                "z",
            );
            for (const x of [-1.2, -0.6, 0.05, 0.7, 1.25])
                box(
                    rover,
                    [0.025, 0.48, 0.025],
                    [x, 1.44, 0.945],
                    materials.metal,
                );
            const arm = new T.Group();
            arm.position.set(-1.25, 1.75, 0.7);
            rover.add(arm);
            const a = new T.Vector3(0, 0, 0),
                b = new T.Vector3(-0.55, 0.55, 0.1),
                c = new T.Vector3(-1.1, 0.08, 0.22);
            beam(arm, a, b, 0.12, materials.hull);
            beam(arm, b, c, 0.1, materials.hull);
            for (const p of [a, b, c])
                cylinder(arm, 0.17, 0.24, [p.x, p.y, p.z], materials.dark, "z");
            beam(
                arm,
                c,
                c.clone().add(new T.Vector3(-0.18, -0.22, 0)),
                0.05,
                materials.metal,
            );
            beam(
                arm,
                c.clone().add(new T.Vector3(-0.18, -0.22, 0)),
                c.clone().add(new T.Vector3(-0.3, -0.08, 0)),
                0.035,
                materials.metal,
            );
            // Reproducible, faceted terrain and ridge stones.
            const groundGeo = new T.PlaneGeometry(100, 100, 80, 80);
            groundGeo.rotateX(-Math.PI / 2);
            const positions = groundGeo.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                const x = positions.getX(i),
                    z = positions.getZ(i);
                positions.setY(
                    i,
                    -0.12 +
                        Math.sin(x * 0.5) * 0.12 +
                        Math.sin(z * 0.43 + x * 0.22) * 0.13 +
                        Math.sin(x * 1.8 + z * 1.3) * 0.035,
                );
            }
            groundGeo.computeVertexNormals();
            const ground = new T.Mesh(groundGeo, materials.rock);
            ground.receiveShadow = true;
            scene.add(ground);
            let seed = 491;
            const rand = () => {
                seed = (seed * 16807) % 2147483647;
                return (seed - 1) / 2147483646;
            };
            const rockGeo = new T.IcosahedronGeometry(1, 0);
            for (let i = 0; i < 75; i++) {
                const rock = new T.Mesh(rockGeo, materials.rock);
                const x = (rand() - 0.5) * 25,
                    z = (rand() - 0.5) * 20;
                if (Math.abs(x - 1.4) < 3 && Math.abs(z) < 2.5) continue;
                const size = 0.08 + rand() * 0.6;
                rock.position.set(x, size * 0.05 - 0.08, z);
                rock.scale.set(size * (1 + rand()), size * 0.6, size);
                rock.rotation.set(rand(), rand() * 3, rand());
                rock.castShadow = true;
                rock.receiveShadow = true;
                scene.add(rock);
            }
            // Layered silhouettes interrupt the horizon without distracting from the vehicle.
            for (let layer = 0; layer < 3; layer++) {
                const vertices: number[] = [];
                const z = -18 - layer * 8;
                for (let i = 0; i < 36; i++) {
                    const x1 = -80 + i * 4.6,
                        x2 = x1 + 4.6;
                    const h1 =
                        1.5 +
                        Math.abs(Math.sin(i * 1.72 + layer)) *
                            (2 + layer * 0.7);
                    const h2 =
                        1.5 +
                        Math.abs(Math.sin((i + 1) * 1.72 + layer)) *
                            (2 + layer * 0.7);
                    vertices.push(
                        x1,
                        -1,
                        z,
                        x2,
                        -1,
                        z,
                        x1,
                        h1,
                        z,
                        x1,
                        h1,
                        z,
                        x2,
                        -1,
                        z,
                        x2,
                        h2,
                        z,
                    );
                }
                const geo = new T.BufferGeometry();
                geo.setAttribute(
                    "position",
                    new T.Float32BufferAttribute(vertices, 3),
                );
                geo.computeVertexNormals();
                const ridge = new T.Mesh(
                    geo,
                    new T.MeshBasicMaterial({
                        color: [0x49342e, 0x63463a, 0x79533f][layer],
                        side: T.DoubleSide,
                    }),
                );
                scene.add(ridge);
            }
            // Distant world; the light and surface are real scene geometry.
            const planetMaterial = new T.MeshStandardMaterial({
                color: 0xb8816d,
                roughness: 1,
            });
            const planet = new T.Mesh(
                new T.SphereGeometry(7, 64, 48),
                planetMaterial,
            );
            planet.position.set(-5, 8, -48);
            scene.add(planet);
            const loader = new T.TextureLoader();
            let planetTexture: Three.Texture | undefined,
                disposed = false;
            loader.load("/images/trajectory/mars-1k.webp", (t) => {
                if (disposed) {
                    t.dispose();
                    return;
                }
                planetTexture = t;
                t.colorSpace = T.SRGBColorSpace;
                planetMaterial.map = t;
                planetMaterial.needsUpdate = true;
                render.render(scene, camera);
            });
            const starGeometry = new T.BufferGeometry(),
                starPositions = new Float32Array(450);
            for (let i = 0; i < starPositions.length; i += 3) {
                starPositions[i] = (rand() - 0.5) * 150;
                starPositions[i + 1] = 15 + rand() * 60;
                starPositions[i + 2] = -65 - rand() * 20;
            }
            starGeometry.setAttribute(
                "position",
                new T.BufferAttribute(starPositions, 3),
            );
            const starMaterial = new T.PointsMaterial({
                color: 0xc4bab0,
                size: 0.15,
            });
            scene.add(new T.Points(starGeometry, starMaterial));
            stage.appendChild(render.domElement);
            stage.hidden = false;
            let frame = 0,
                visible = true,
                paused = false;
            const motion = matchMedia("(prefers-reduced-motion: reduce)");
            const resize = () => {
                const w = stage.clientWidth,
                    h = stage.clientHeight;
                if (!w || !h) return;
                render.setSize(w, h, false);
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
                setCamera();
                render.render(scene, camera);
            };
            const tick = (time: number) => {
                frame = 0;
                if (disposed || !visible || document.hidden) {
                    stage.dataset.state = "paused";
                    return;
                }
                stage.dataset.state =
                    motion.matches || paused ? "paused" : "running";
                if (!motion.matches && !paused) {
                    mast.rotation.y = Math.sin(time * 0.00022) * 0.12;
                    arm.rotation.z = Math.sin(time * 0.0003) * 0.025;
                }
                render.render(scene, camera);
                if (!motion.matches && !paused)
                    frame = requestAnimationFrame(tick);
            };
            const wake = () => {
                if (!frame && visible && !document.hidden && !disposed)
                    tick(performance.now());
                else if (document.hidden || !visible)
                    stage.dataset.state = "paused";
            };
            const observer = new IntersectionObserver((entries) => {
                visible = entries[0]?.isIntersecting ?? false;
                if (!visible && frame) {
                    cancelAnimationFrame(frame);
                    frame = 0;
                }
                wake();
            });
            observer.observe(stage);
            const ro = new ResizeObserver(resize);
            ro.observe(stage);
            const syncMotion = () => {
                if (motionButton) {
                    motionButton.disabled = motion.matches;
                    motionButton.textContent = motion.matches
                        ? "Motion reduced by system"
                        : paused
                          ? "Resume motion"
                          : "Pause motion";
                    motionButton.hidden = false;
                }
                if ((motion.matches || paused) && frame) {
                    cancelAnimationFrame(frame);
                    frame = 0;
                }
                wake();
            };
            const toggleMotion = () => {
                paused = !paused;
                syncMotion();
            };
            motionButton?.addEventListener("click", toggleMotion);
            const lost = (event: Event) => {
                event.preventDefault();
                cleanup?.();
                cleanup = undefined;
            };
            render.domElement.addEventListener("webglcontextlost", lost);
            document.addEventListener("visibilitychange", wake);
            motion.addEventListener("change", syncMotion);
            cleanup = () => {
                disposed = true;
                cancelAnimationFrame(frame);
                observer.disconnect();
                ro.disconnect();
                document.removeEventListener("visibilitychange", wake);
                motion.removeEventListener("change", syncMotion);
                motionButton?.removeEventListener("click", toggleMotion);
                if (motionButton) motionButton.hidden = true;
                render.domElement.removeEventListener("webglcontextlost", lost);
                scene.traverse((object) => {
                    const mesh = object as Three.Mesh;
                    mesh.geometry?.dispose();
                    const mat = mesh.material;
                    if (mat)
                        (Array.isArray(mat) ? mat : [mat]).forEach((m) =>
                            m.dispose(),
                        );
                });
                Object.values(materials).forEach((m) => m.dispose());
                planetMaterial.dispose();
                planetTexture?.dispose();
                skyTexture.dispose();
                starMaterial.dispose();
                sun.shadow.dispose();
                render.dispose();
                render.domElement.remove();
                stage.hidden = true;
                if (poster) poster.hidden = false;
                stage.dataset.state = "paused";
            };
            resize();
            syncMotion();
            if (poster) poster.hidden = true;
        } catch {
            cleanup?.();
            cleanup = undefined;
            renderer?.dispose();
            stage.hidden = true;
            if (poster) poster.hidden = false;
            stage.dataset.state = "error";
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
