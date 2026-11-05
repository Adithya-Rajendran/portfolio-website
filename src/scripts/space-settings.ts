import * as T from "three";
import type { SpaceStudy } from "./space-studies";

/** Context gives the instruments a place and a useful sense of scale. */
export function makeStudySetting(kind: SpaceStudy) {
    const root = new T.Group();
    const geometries = new Set<T.BufferGeometry>();
    const materials = new Set<T.Material>();
    const textures = new Set<T.Texture>();
    let disposed = false;
    const metal = new T.MeshStandardMaterial({
        color: 0x303c40,
        metalness: 0.78,
        roughness: 0.42,
    });
    const ceramic = new T.MeshStandardMaterial({
        color: 0x8c938a,
        metalness: 0.38,
        roughness: 0.6,
    });
    const amber = new T.MeshStandardMaterial({
        color: 0xebc18b,
        emissive: 0xdfa05d,
        emissiveIntensity: 2.2,
    });
    const cyan = new T.MeshStandardMaterial({
        color: 0x80c6d0,
        emissive: 0x53b9d2,
        emissiveIntensity: 2,
    });
    const mesh = (
        geo: T.BufferGeometry,
        mat: T.Material,
        xyz: number[],
        parent = root,
    ) => {
        geometries.add(geo);
        materials.add(mat);
        const m = new T.Mesh(geo, mat);
        m.position.fromArray(xyz);
        m.castShadow = m.receiveShadow = true;
        parent.add(m);
        return m;
    };
    const box = (size: number[], xyz: number[], mat = metal, parent = root) =>
        mesh(
            new T.BoxGeometry(...(size as [number, number, number])),
            mat,
            xyz,
            parent,
        );
    const line = (a: T.Vector3, b: T.Vector3, radius: number, mat = metal) => {
        const m = mesh(
            new T.CylinderGeometry(radius, radius, a.distanceTo(b), 8),
            mat,
            a.clone().add(b).multiplyScalar(0.5).toArray(),
        );
        m.quaternion.setFromUnitVectors(
            new T.Vector3(0, 1, 0),
            b.clone().sub(a).normalize(),
        );
    };
    let ready = Promise.resolve();
    if (kind === "robotics") {
        const deck = new T.MeshStandardMaterial({
            color: 0x252f31,
            metalness: 0.55,
            roughness: 0.65,
        });
        const panelCanvas = document.createElement("canvas");
        panelCanvas.width = panelCanvas.height = 512;
        const panel = panelCanvas.getContext("2d")!;
        panel.fillStyle = "#9b9f9b";
        panel.fillRect(0, 0, 512, 512);
        panel.strokeStyle = "#4c5556";
        panel.lineWidth = 2;
        panel.strokeRect(3, 3, 506, 506);
        for (const x of [12, 500])
            for (const y of [12, 500]) {
                panel.fillStyle = "#414b4d";
                panel.beginPath();
                panel.arc(x, y, 3, 0, Math.PI * 2);
                panel.fill();
            }
        const deckMap = new T.CanvasTexture(panelCanvas);
        deckMap.colorSpace = T.SRGBColorSpace;
        deckMap.wrapS = deckMap.wrapT = T.RepeatWrapping;
        deckMap.repeat.set(14, 14);
        textures.add(deckMap);
        deck.map = deckMap;
        box([40, 0.2, 40], [0, -2.15, 7], deck);
        // Sparse rails, structural arches and floor inlays imply an observation lab.
        for (const x of [-4.3, 4.3]) {
            const curve = new T.CatmullRomCurve3([
                new T.Vector3(x, -2, -3.2),
                new T.Vector3(x, 1.5, -3.5),
                new T.Vector3(x * 0.82, 4.8, -3.5),
                new T.Vector3(x * 0.55, 6, -3.5),
            ]);
            mesh(
                new T.TubeGeometry(curve, 32, 0.12, 8, false),
                metal,
                [0, 0, 0],
            );
            box([0.055, 0.5, 0.06], [x, 0.1, -3.05], amber);
            line(
                new T.Vector3(x, -2, -2.8),
                new T.Vector3(x, -0.95, -2.8),
                0.04,
            );
        }
        for (const y of [-1.55, -0.95])
            line(new T.Vector3(-5, y, -3), new T.Vector3(5, y, -3), 0.025);
        for (const x of [-3.5, 3.5]) {
            box([1.4, 0.8, 0.9], [x, -1.65, -2.3], ceramic);
            box([1.45, 0.04, 0.95], [x, -1.23, -2.3]);
            for (let i = 0; i < 4; i++)
                box(
                    [0.12, 0.035, 0.02],
                    [x - 0.4 + i * 0.25, -1.4, -1.83],
                    i === 0 ? amber : cyan,
                );
        }
        for (const x of [-2.8, 2.8])
            box([0.018, 0.004, 7], [x, -2.042, -0.5], amber);
        const terrain = new T.PlaneGeometry(90, 65, 140, 100);
        terrain.rotateX(-Math.PI / 2);
        terrain.translate(0, -3.7, -36);
        const pos = terrain.getAttribute("position");
        const colors: number[] = [];
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i),
                z = pos.getZ(i);
            const horizon = T.MathUtils.smoothstep(-z, 7, 16);
            const y =
                (Math.sin(x * 0.24 + z * 0.15) * 1.7 +
                    Math.sin(x * 0.51 - z * 0.1) * 0.7 +
                    Math.sin(z * 0.38 + x * 0.05) * 1.2) *
                horizon;
            pos.setY(i, -3.7 + y);
            const c = new T.Color(0x715140).multiplyScalar(
                0.72 + (y + 4) * 0.05,
            );
            colors.push(c.r, c.g, c.b);
        }
        terrain.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
        terrain.computeVertexNormals();
        const dust = new T.MeshStandardMaterial({
            color: 0xc7a18a,
            roughness: 1,
            vertexColors: true,
        });
        mesh(terrain, dust, [0, 0, 0]);
        ready = new T.TextureLoader()
            .loadAsync("/images/scenes/regolith-color-v1.webp")
            .then((map) => {
                if (disposed) {
                    map.dispose();
                    return;
                }
                map.colorSpace = T.SRGBColorSpace;
                map.wrapS = map.wrapT = T.RepeatWrapping;
                map.repeat.set(15, 12);
                textures.add(map);
                dust.map = map;
                dust.needsUpdate = true;
            })
            .catch(() => {
                /* Vertex-coloured terrain remains complete offline. */
            });
    } else if (kind === "workshop") {
        for (const [x, y, z, scale] of [
            [-3.4, -1.45, 1.5, 0.3],
            [3.9, 1.6, -2.5, 0.16],
        ]) {
            const craft = new T.Group();
            root.add(craft);
            craft.position.set(x, y, z);
            craft.scale.setScalar(scale);
            box([1.3, 0.75, 1], [0, 0, 0], ceramic, craft);
            box([0.65, 0.38, 0.02], [0, 0.04, 0.52], metal, craft);
            for (const s of [-1, 1]) {
                const engine = mesh(
                    new T.CylinderGeometry(0.17, 0.21, 0.4, 16),
                    metal,
                    [s * 0.72, -0.1, -0.3],
                    craft,
                );
                engine.rotation.x = Math.PI / 2;
                const glow = mesh(
                    new T.CircleGeometry(0.14, 20),
                    cyan,
                    [s * 0.72, -0.1, -0.52],
                    craft,
                );
                glow.rotation.y = Math.PI;
                box([0.025, 0.06, 0.5], [s * 0.68, 0.23, 0], amber, craft);
            }
            craft.rotation.set(0.2, -0.7, -0.2);
        }
    }
    return {
        root,
        ready,
        dispose() {
            disposed = true;
            geometries.forEach((g) => g.dispose());
            materials.forEach((m) => m.dispose());
            textures.forEach((t) => t.dispose());
        },
    };
}
