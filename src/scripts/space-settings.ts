import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { SpaceStudy } from "./space-studies";
import { makeObservationLab } from "./study-lab";

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
    const box = (
        size: number[],
        xyz: number[],
        mat: T.Material = metal,
        parent = root,
    ) =>
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
    let ready = Promise.resolve();
    if (kind === "robotics") {
        ready = makeObservationLab({
            mesh,
            box,
            textures,
            isDisposed: () => disposed,
        });
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
