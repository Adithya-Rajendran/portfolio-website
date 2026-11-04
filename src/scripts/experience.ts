import type * as Three from "three";
export {};
const section = document.querySelector<HTMLElement>(".experience-visual");
const start = section?.querySelector<HTMLButtonElement>(
    "[data-experience-start]",
);
const stage = section?.querySelector<HTMLElement>("[data-experience-stage]");
const status = section?.querySelector<HTMLElement>("[data-experience-status]");
const controls = section?.querySelector<HTMLElement>(
    "[data-experience-controls]",
);
const entries = [
    ...(section?.querySelectorAll<HTMLButtonElement>(
        "[data-experience-entry]",
    ) ?? []),
];
const details = [
    ...(section?.querySelectorAll<HTMLElement>("[data-experience-detail]") ??
        []),
];

const motionButton = section?.querySelector<HTMLButtonElement>(
    "[data-experience-motion]",
);

if (section && start && stage && status && controls && motionButton) {
    section.hidden = false;
    let paused = false;
    let cleanup: (() => void) | undefined;
    let loading = false;
    start.addEventListener("click", async () => {
        if (cleanup) {
            cleanup();
            cleanup = undefined;
            stage.hidden = true;
            controls.hidden = true;
            start.textContent = "Start visual";
            return;
        }
        if (loading) return;
        loading = true;
        start.disabled = true;
        status.textContent = "Loading visual…";
        try {
            const THREE = await import("three");
            const renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
            });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
            stage.hidden = false;
            stage.appendChild(renderer.domElement);
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
            camera.position.set(0, 1, 12);
            const group = new THREE.Group();
            scene.add(group);
            const curve = new THREE.CatmullRomCurve3(
                Array.from({ length: 40 }, (_, i) => {
                    const t = i / 39;
                    return new THREE.Vector3(
                        (t - 0.5) * 9,
                        Math.sin(t * Math.PI * 3) * 0.8,
                        Math.cos(t * Math.PI * 3) * 0.8,
                    );
                }),
            );
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(
                curve.getPoints(200),
            );
            const lineMaterial = new THREE.LineBasicMaterial({
                color: 0x658761,
            });
            group.add(new THREE.Line(lineGeometry, lineMaterial));
            const nodeGeometry = new THREE.SphereGeometry(0.09, 16, 12);
            const nodeMaterial = new THREE.MeshBasicMaterial({
                color: 0xdfa05d,
            });
            const nodes: Three.Mesh[] = [];
            for (let i = 0; i < entries.length; i++) {
                const node = new THREE.Mesh(nodeGeometry, nodeMaterial.clone());
                node.position.copy(
                    curve.getPoint(
                        entries.length === 1 ? 0.5 : i / (entries.length - 1),
                    ),
                );
                group.add(node);
                nodes.push(node);
            }
            const pointsGeometry = new THREE.BufferGeometry();
            const points = new Float32Array(360);
            for (let i = 0; i < points.length; i += 3) {
                points[i] = (Math.random() - 0.5) * 18;
                points[i + 1] = (Math.random() - 0.5) * 9;
                points[i + 2] = (Math.random() - 0.5) * 6 - 2;
            }
            pointsGeometry.setAttribute(
                "position",
                new THREE.BufferAttribute(points, 3),
            );
            const pointsMaterial = new THREE.PointsMaterial({
                color: 0xc6b8a4,
                size: 0.025,
            });
            scene.add(new THREE.Points(pointsGeometry, pointsMaterial));
            let visible = true,
                frame = 0,
                dragging = false,
                lastX = 0;
            const motion = matchMedia("(prefers-reduced-motion: reduce)");
            const resize = () => {
                const { clientWidth: w, clientHeight: h } = stage;
                if (!w || !h) return;
                renderer.setSize(w, h, false);
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
                renderer.render(scene, camera);
            };
            const draw = () => {
                frame = 0;
                if (!visible || document.hidden) return;
                if (!motion.matches && !paused) group.rotation.y += 0.002;
                renderer.render(scene, camera);
                if (!motion.matches && !paused)
                    frame = requestAnimationFrame(draw);
            };
            const wake = () => {
                if (!frame && visible && !document.hidden) draw();
            };
            const syncMotion = () => {
                motionButton.disabled = motion.matches;
                motionButton.textContent = motion.matches
                    ? "Motion reduced by system"
                    : paused
                      ? "Resume motion"
                      : "Pause motion";
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
            motionButton.addEventListener("click", toggleMotion);
            syncMotion();
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
            const pointerDown = (e: PointerEvent) => {
                dragging = true;
                lastX = e.clientX;
                stage.setPointerCapture(e.pointerId);
            };
            const pointerMove = (e: PointerEvent) => {
                if (!dragging) return;
                group.rotation.y += (e.clientX - lastX) * 0.01;
                lastX = e.clientX;
                renderer.render(scene, camera);
            };
            const pointerUp = () => {
                dragging = false;
            };
            const key = (e: KeyboardEvent) => {
                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                e.preventDefault();
                group.rotation.y += e.key === "ArrowLeft" ? -0.15 : 0.15;
                renderer.render(scene, camera);
            };
            const select = (index: number) => {
                entries.forEach((entry, i) =>
                    entry.setAttribute("aria-pressed", String(i === index)),
                );
                details.forEach((detail, i) => {
                    detail.hidden = i !== index;
                });
                nodes.forEach((node, i) => {
                    node.scale.setScalar(i === index ? 2.1 : 1);
                });
                renderer.render(scene, camera);
            };
            const selections = entries.map((entry, i) => {
                const handler = () => select(i);
                entry.addEventListener("click", handler);
                return handler;
            });
            const lost = (e: Event) => {
                e.preventDefault();
                status.textContent =
                    "The visual is unavailable. The experience list remains available below.";
                cleanup?.();
                cleanup = undefined;
                stage.hidden = true;
                controls.hidden = true;
                start.textContent = "Try visual again";
            };
            stage.addEventListener("pointerdown", pointerDown);
            stage.addEventListener("pointermove", pointerMove);
            stage.addEventListener("pointerup", pointerUp);
            stage.addEventListener("pointercancel", pointerUp);
            stage.addEventListener("keydown", key);
            renderer.domElement.addEventListener("webglcontextlost", lost);
            document.addEventListener("visibilitychange", wake);
            motion.addEventListener("change", syncMotion);
            cleanup = () => {
                cancelAnimationFrame(frame);
                observer.disconnect();
                ro.disconnect();
                stage.removeEventListener("pointerdown", pointerDown);
                stage.removeEventListener("pointermove", pointerMove);
                stage.removeEventListener("pointerup", pointerUp);
                stage.removeEventListener("pointercancel", pointerUp);
                stage.removeEventListener("keydown", key);
                document.removeEventListener("visibilitychange", wake);
                motion.removeEventListener("change", syncMotion);
                motionButton.removeEventListener("click", toggleMotion);
                renderer.domElement.removeEventListener(
                    "webglcontextlost",
                    lost,
                );
                entries.forEach((entry, i) =>
                    entry.removeEventListener("click", selections[i]),
                );
                lineGeometry.dispose();
                lineMaterial.dispose();
                nodeGeometry.dispose();
                nodeMaterial.dispose();
                nodes.forEach((node) =>
                    (node.material as Three.Material).dispose(),
                );
                pointsGeometry.dispose();
                pointsMaterial.dispose();
                renderer.dispose();
                renderer.domElement.remove();
            };
            controls.hidden = false;
            select(0);
            resize();
            wake();
            start.textContent = "Close visual";
            status.textContent = "";
        } catch {
            stage.hidden = true;
            status.textContent =
                "The visual could not be loaded. The experience list remains available below.";
        } finally {
            loading = false;
            start.disabled = false;
        }
    });
    window.addEventListener("pagehide", () => cleanup?.(), { once: true });
}
