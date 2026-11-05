import * as T from "three";
import { ImprovedNoise } from "three/addons/math/ImprovedNoise.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
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
            new RoundedBoxGeometry(
                ...(size as [number, number, number]),
                Math.min(...size) < 0.15 ? 2 : 4,
                Math.min(...size) * 0.1,
            ),
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
        root.position.y = -0.25;
        const deck = new T.MeshStandardMaterial({
            color: 0x55605e,
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
                new T.TubeGeometry(curve, 64, 0.12, 16, false),
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
            box([1.25, 0.56, 0.025], [x, -1.65, -1.84]);
            box([0.48, 0.29, 0.027], [x - 0.29, -1.58, -1.82], cyan);
            for (let i = 0; i < 9; i++)
                box([0.34, 0.014, 0.025], [x + 0.35, -1.47 - i * 0.04, -1.82]);
            for (const side of [-1, 1]) {
                box(
                    [0.06, 0.6, 0.065],
                    [x + side * 0.64, -1.65, -1.82],
                    ceramic,
                );
                box([0.12, 0.04, 0.04], [x + side * 0.4, -1.34, -1.8], amber);
                const upright = new T.CylinderGeometry(0.05, 0.05, 1.2, 24);
                mesh(upright, metal, [x + side * 0.7, -1.4, -2.7]);
            }
            for (let i = 0; i < 4; i++)
                box(
                    [0.12, 0.035, 0.02],
                    [x - 0.4 + i * 0.25, -1.4, -1.83],
                    i === 0 ? amber : cyan,
                );
        }
        for (const x of [-2.8, 2.8])
            box([0.018, 0.004, 7], [x, -2.042, -0.5], amber);
        const haze = new T.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: {},
            vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
            fragmentShader: `varying vec2 vUv;void main(){float mist=(1.-smoothstep(.0,.85,vUv.y))*.72;gl_FragColor=vec4(.26,.15,.095,mist);}`,
        });
        mesh(new T.PlaneGeometry(120, 28), haze, [0, 6, -72]);
        const noise = new ImprovedNoise();
        const terrain = new T.PlaneGeometry(100, 80, 240, 180);
        terrain.rotateX(-Math.PI / 2);
        terrain.translate(0, -3.7, -36);
        const pos = terrain.getAttribute("position");
        const colors: number[] = [];
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i),
                z = pos.getZ(i);
            const horizon = T.MathUtils.smoothstep(-z, 7, 16);
            let ridge = 0,
                amplitude = 1,
                frequency = 0.11;
            for (let octave = 0; octave < 4; octave++) {
                ridge +=
                    (1 -
                        Math.abs(
                            noise.noise(x * frequency, z * frequency, 13),
                        )) *
                    amplitude;
                amplitude *= 0.48;
                frequency *= 2.05;
            }
            const y = (ridge - 1.05) * 5.5 * horizon;
            pos.setY(i, -3.7 + y);
            const c = new T.Color().setScalar(
                0.7 + noise.noise(x * 0.4, z * 0.4, 7) * 0.15,
            );
            colors.push(c.r, c.g, c.b);
        }
        terrain.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
        terrain.computeVertexNormals();
        const dust = new T.MeshStandardMaterial({
            color: 0xd2aa87,
            roughness: 1,
            bumpScale: 0.2,
            envMapIntensity: 0.1,
            vertexColors: true,
        });
        mesh(terrain, dust, [0, 0, 0]);
        ready = Promise.all(
            [
                ["regolith-color-v1.webp", true],
                ["regolith-height-v1.webp", false],
            ].map(async ([file, color]) => {
                try {
                    const map = await new T.TextureLoader().loadAsync(
                        `/images/scenes/${file}`,
                    );
                    if (disposed) {
                        map.dispose();
                        return;
                    }
                    if (color) map.colorSpace = T.SRGBColorSpace;
                    map.wrapS = map.wrapT = T.RepeatWrapping;
                    map.repeat.set(28, 22);
                    map.anisotropy = 4;
                    textures.add(map);
                    if (color) dust.map = map;
                    else dust.bumpMap = map;
                    dust.needsUpdate = true;
                } catch {
                    // The terrain remains usable without either optional map.
                }
            }),
        ).then(() => {});
    } else if (kind === "workshop") {
        for (const [x, y, z, scale] of [
            [-3.1, -1.2, 1.5, 0.44],
            [3.9, 1.6, -2.5, 0.16],
        ]) {
            const craft = new T.Group();
            root.add(craft);
            craft.position.set(x, y, z);
            craft.scale.setScalar(scale);
            const hull = mesh(
                new T.CapsuleGeometry(0.4, 0.7, 12, 32),
                ceramic,
                [0, 0, 0],
                craft,
            );
            hull.rotation.x = Math.PI / 2;
            for (const z of [-0.34, 0.34]) {
                const collar = mesh(
                    new T.TorusGeometry(0.405, 0.022, 12, 48),
                    metal,
                    [0, 0, z],
                    craft,
                );
                collar.rotation.z = 0.2;
            }
            box([0.58, 0.23, 0.72], [0, 0.32, 0], ceramic, craft);
            box([0.47, 0.15, 0.025], [0, 0.34, 0.37], metal, craft);
            for (const x of [-0.22, 0.22]) {
                box([0.08, 0.04, 0.04], [x, 0.45, 0.26], amber, craft);
                box([0.08, 0.04, 0.04], [x, 0.45, -0.26], cyan, craft);
            }
            for (const side of [-1, 1]) {
                box([0.24, 0.38, 0.5], [side * 0.45, -0.04, 0], metal, craft);
                for (let i = 0; i < 6; i++)
                    box(
                        [0.03, 0.34, 0.04],
                        [side * 0.59, -0.04, -0.22 + i * 0.08],
                        ceramic,
                        craft,
                    );
                const bell = mesh(
                    new T.CylinderGeometry(0.11, 0.2, 0.24, 32, 1, true),
                    metal,
                    [side * 0.47, -0.05, -0.55],
                    craft,
                );
                bell.rotation.x = Math.PI / 2;
            }
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
    // All setting parts are rigid. Bake their transforms relative to the root,
    // retaining material and vertex layouts so normals, UVs and colors survive.
    root.updateMatrixWorld(true);
    const inverseRoot = root.matrixWorld.clone().invert();
    const buckets = new Map<
        T.Material,
        Map<string, Array<{ object: T.Mesh; geometry: T.BufferGeometry }>>
    >();
    root.traverse((object) => {
        if (!(object instanceof T.Mesh) || Array.isArray(object.material))
            return;
        const source = object.geometry as T.BufferGeometry;
        const signature = Object.entries(source.attributes)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(
                ([name, attr]) =>
                    `${name}:${attr.itemSize}:${attr.normalized}:${attr.array.constructor.name}`,
            )
            .join("|");
        let layouts = buckets.get(object.material);
        if (!layouts) {
            layouts = new Map();
            buckets.set(object.material, layouts);
        }
        const bucket = layouts.get(signature) ?? [];
        bucket.push({ object, geometry: source });
        layouts.set(signature, bucket);
    });
    for (const [material, layouts] of buckets) {
        for (const bucket of layouts.values()) {
            if (bucket.length < 2) continue;
            const baked = bucket.map(({ object, geometry }) => {
                const copy = geometry.index
                    ? geometry.toNonIndexed()
                    : geometry.clone();
                copy.applyMatrix4(
                    inverseRoot.clone().multiply(object.matrixWorld),
                );
                return copy;
            });
            const merged = mergeGeometries(baked, false);
            baked.forEach((geometry) => geometry.dispose());
            if (!merged) continue;
            bucket.forEach(({ object }) => object.removeFromParent());
            mesh(merged, material, [0, 0, 0]);
        }
    }
    const used = new Set<T.BufferGeometry>();
    root.traverse((object) => {
        if (object instanceof T.Mesh) used.add(object.geometry);
    });
    geometries.forEach((geometry) => {
        if (!used.has(geometry)) {
            geometry.dispose();
            geometries.delete(geometry);
        }
    });
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
