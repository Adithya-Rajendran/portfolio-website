import type * as Three from "three";

for (const section of document.querySelectorAll<HTMLElement>(
    "[data-project-viewer]",
)) {
    const button = section.querySelector<HTMLButtonElement>(
        "[data-viewer-start]",
    );
    const stage = section.querySelector<HTMLElement>("[data-viewer-stage]");
    const status = section.querySelector<HTMLElement>("[data-viewer-status]");
    if (!button || !stage || !status) continue;
    section.hidden = false;
    const disposeScene = (scene: Three.Scene) => {
        scene.traverse((object) => {
            const mesh = object as Three.Mesh;
            mesh.geometry?.dispose();
            const materials = Array.isArray(mesh.material)
                ? mesh.material
                : mesh.material
                  ? [mesh.material]
                  : [];
            for (const material of materials) {
                for (const value of Object.values(material))
                    if (
                        value &&
                        typeof value === "object" &&
                        "isTexture" in value
                    )
                        (value as Three.Texture).dispose();
                material.dispose();
            }
        });
    };
    let cleanup: (() => void) | undefined,
        loading = false;
    button.addEventListener("click", async () => {
        if (cleanup) {
            cleanup();
            cleanup = undefined;
            stage.hidden = true;
            button.textContent = "Explore 3D model";
            return;
        }
        if (loading) return;
        loading = true;
        button.disabled = true;
        status.textContent = "Loading model…";
        let renderer: Three.WebGLRenderer | undefined;
        let failedScene: Three.Scene | undefined;
        try {
            const THREE = await import("three");
            renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
            });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
            const scene = new THREE.Scene();
            failedScene = scene;
            const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
            camera.position.set(3, 2.3, 4.5);
            camera.lookAt(0, 0, 0);
            scene.add(new THREE.HemisphereLight(0xf5ead8, 0x302c28, 2));
            const light = new THREE.DirectionalLight(0xffffff, 2);
            light.position.set(3, 5, 4);
            scene.add(light);
            const group = new THREE.Group();
            scene.add(group);
            if (section.dataset.kind === "procedural") {
                const dark = new THREE.MeshStandardMaterial({
                    color: 0x363a32,
                    metalness: 0.45,
                    roughness: 0.55,
                });
                const panel = new THREE.MeshStandardMaterial({
                    color: 0x6c7460,
                    metalness: 0.45,
                    roughness: 0.45,
                });
                const accent = new THREE.MeshStandardMaterial({
                    color: 0xdfa05d,
                    emissive: 0xac5045,
                });
                const box = (
                    w: number,
                    h: number,
                    d: number,
                    x: number,
                    y: number,
                    z: number,
                    material: Three.Material,
                ) => {
                    const mesh = new THREE.Mesh(
                        new THREE.BoxGeometry(w, h, d),
                        material,
                    );
                    mesh.position.set(x, y, z);
                    group.add(mesh);
                };
                for (const x of [-0.75, 0.75])
                    for (const z of [-0.5, 0.5])
                        box(0.08, 2.6, 0.08, x, 0, z, dark);
                for (const y of [-1.25, 1.25])
                    box(1.6, 0.08, 1.08, 0, y, 0, dark);
                for (let i = 0; i < 6; i++) {
                    const y = -0.95 + i * 0.38;
                    box(1.4, 0.26, 0.85, 0, y, 0, panel);
                    for (let j = 0; j < 4; j++)
                        box(0.05, 0.05, 0.02, -0.5 + j * 0.13, y, 0.44, accent);
                }
            } else {
                const url = section.dataset.url;
                if (!url) throw new Error("Missing model");
                const parsed = new URL(url, location.href);
                if (
                    parsed.protocol !== "https:" &&
                    parsed.origin !== location.origin
                )
                    throw new Error("Invalid model URL");
                const { GLTFLoader } =
                    await import("three/addons/loaders/GLTFLoader.js");
                const gltf = await new GLTFLoader().loadAsync(parsed.href);
                group.add(gltf.scene);
                const bounds = new THREE.Box3().setFromObject(gltf.scene);
                const size = bounds.getSize(new THREE.Vector3());
                const center = bounds.getCenter(new THREE.Vector3());
                const scale = 2.5 / Math.max(size.x, size.y, size.z, 0.001);
                gltf.scene.position.sub(center);
                group.scale.setScalar(scale);
            }
            stage.hidden = false;
            stage.appendChild(renderer.domElement);
            let frame = 0,
                visible = true,
                dragging = false,
                lastX = 0;
            const motion = matchMedia("(prefers-reduced-motion: reduce)");
            const resize = () => {
                const w = stage.clientWidth,
                    h = stage.clientHeight;
                if (!w || !h || !renderer) return;
                renderer.setSize(w, h, false);
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
                renderer.render(scene, camera);
            };
            const draw = () => {
                frame = 0;
                if (!visible || document.hidden || !renderer) return;
                if (!motion.matches) group.rotation.y += 0.003;
                renderer.render(scene, camera);
                if (!motion.matches) frame = requestAnimationFrame(draw);
            };
            const wake = () => {
                if (!frame && visible && !document.hidden) draw();
            };
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
            const down = (e: PointerEvent) => {
                dragging = true;
                lastX = e.clientX;
                stage.setPointerCapture(e.pointerId);
            };
            const move = (e: PointerEvent) => {
                if (!dragging || !renderer) return;
                group.rotation.y += (e.clientX - lastX) * 0.01;
                lastX = e.clientX;
                renderer.render(scene, camera);
            };
            const up = () => {
                dragging = false;
            };
            const key = (e: KeyboardEvent) => {
                if (
                    (e.key !== "ArrowLeft" && e.key !== "ArrowRight") ||
                    !renderer
                )
                    return;
                e.preventDefault();
                group.rotation.y += e.key === "ArrowLeft" ? -0.15 : 0.15;
                renderer.render(scene, camera);
            };
            const canvas = renderer.domElement;
            const lost = (e: Event) => {
                e.preventDefault();
                status.textContent =
                    "The model is unavailable. The project image remains available.";
                cleanup?.();
                cleanup = undefined;
                stage.hidden = true;
                button.textContent = "Try model again";
            };
            stage.addEventListener("pointerdown", down);
            stage.addEventListener("pointermove", move);
            stage.addEventListener("pointerup", up);
            stage.addEventListener("pointercancel", up);
            stage.addEventListener("keydown", key);
            canvas.addEventListener("webglcontextlost", lost);
            document.addEventListener("visibilitychange", wake);
            motion.addEventListener("change", wake);
            cleanup = () => {
                cancelAnimationFrame(frame);
                observer.disconnect();
                ro.disconnect();
                stage.removeEventListener("pointerdown", down);
                stage.removeEventListener("pointermove", move);
                stage.removeEventListener("pointerup", up);
                stage.removeEventListener("pointercancel", up);
                stage.removeEventListener("keydown", key);
                canvas.removeEventListener("webglcontextlost", lost);
                document.removeEventListener("visibilitychange", wake);
                motion.removeEventListener("change", wake);
                disposeScene(scene);
                renderer?.dispose();
                canvas.remove();
            };
            resize();
            wake();
            status.textContent = "";
            button.textContent = "Close model";
        } catch {
            if (failedScene) disposeScene(failedScene);
            renderer?.dispose();
            stage.hidden = true;
            status.textContent =
                "The model could not be loaded. The project image remains available.";
        } finally {
            loading = false;
            button.disabled = false;
        }
    });
    window.addEventListener("pagehide", () => cleanup?.(), { once: true });
}
