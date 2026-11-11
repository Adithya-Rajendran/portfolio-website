import * as T from "three";
import { finishSurface } from "./study-surfaces";
import { makePerceptionArm } from "./study-robotics";
import { makeRelay } from "./study-orbital";
import { finishWebbSurfaces, makeFoilRelief } from "./study-webb";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export type SpaceStudy = "workshop" | "observatory" | "robotics" | "relay";

/** What the page can afford: texture filtering, and a lighter model. */
export interface StudyDetail {
    anisotropy?: number;
    lite?: boolean;
}

/** Original instruments, built in metres with shared materials and reusable parts. */
export function makeSpaceStudy(kind: SpaceStudy, detail: StudyDetail = {}) {
    const root = new T.Group();
    const ivory = new T.MeshStandardMaterial({
        color: 0xc9c9bd,
        metalness: 0.48,
        roughness: 0.46,
    });
    const metal = new T.MeshStandardMaterial({
        color: 0x9cabb7,
        metalness: 0.9,
        roughness: 0.38,
    });
    const gold = new T.MeshStandardMaterial({
        color: 0xbf995e,
        metalness: 0.85,
        roughness: 0.36,
    });
    const dark = new T.MeshStandardMaterial({
        color: 0x18232b,
        metalness: 0.65,
        roughness: 0.33,
    });
    const light = new T.MeshStandardMaterial({
        color: 0xc5e8e2,
        emissive: 0x81b7ad,
        emissiveIntensity: 1.6,
    });
    const amber = new T.MeshStandardMaterial({
        color: 0xf3c483,
        emissive: 0xdfa05d,
        emissiveIntensity: 0.75,
    });
    finishSurface(metal);
    finishSurface(gold);
    const textures: T.Texture[] = [];
    const materials: T.Material[] = [ivory, metal, gold, dark, light, amber];
    const foilRelief = makeFoilRelief();
    textures.push(foilRelief);
    const foil = gold.clone();
    foil.bumpMap = foilRelief;
    foil.bumpScale = 0.022;
    foil.roughness = 0.38;
    materials.push(foil);
    const geometries = new Set<T.BufferGeometry>();
    const boxCache = new Map<string, T.BufferGeometry>();
    const mesh = (
        parent: T.Object3D,
        geometry: T.BufferGeometry,
        material: T.Material,
        position = [0, 0, 0],
    ) => {
        geometries.add(geometry);
        const object = new T.Mesh(geometry, material);
        object.position.fromArray(position);
        object.castShadow = true;
        object.receiveShadow = true;
        parent.add(object);
        return object;
    };
    const box = (
        parent: T.Object3D,
        size: [number, number, number],
        position: number[],
        material: T.Material,
    ) => {
        const key = size.join(",");
        let geometry = boxCache.get(key);
        if (!geometry) {
            geometry = new RoundedBoxGeometry(
                ...size,
                Math.min(...size) < 0.15 ? 2 : 4,
                Math.min(...size) * 0.16,
            );
            boxCache.set(key, geometry);
        }
        return mesh(parent, geometry, material, position);
    };
    const tube = (
        parent: T.Object3D,
        radius: number,
        length: number,
        position: number[],
        material: T.Material,
        sides = 48,
    ) =>
        mesh(
            parent,
            new T.CylinderGeometry(radius, radius, length, sides),
            material,
            position,
        );
    const ring = (
        parent: T.Object3D,
        radius: number,
        thickness: number,
        position: number[],
        material: T.Material,
    ) =>
        mesh(
            parent,
            new T.TorusGeometry(
                radius,
                thickness,
                thickness < 0.025 ? 8 : 16,
                Math.max(32, Math.min(128, Math.ceil(radius * 100))),
            ),
            material,
            position,
        );
    const strut = (
        parent: T.Object3D,
        from: number[],
        to: number[],
        radius: number,
        material: T.Material = metal,
    ) => {
        const start = new T.Vector3().fromArray(from),
            end = new T.Vector3().fromArray(to),
            direction = end.clone().sub(start);
        const object = tube(
            parent,
            radius,
            direction.length(),
            start.add(end).multiplyScalar(0.5).toArray(),
            material,
            12,
        );
        object.quaternion.setFromUnitVectors(
            new T.Vector3(0, 1, 0),
            direction.normalize(),
        );
        return object;
    };
    const bolts = (
        parent: T.Object3D,
        radius: number,
        z: number,
        count = 8,
    ) => {
        const geometry = new T.CylinderGeometry(0.035, 0.035, 0.035, 6);
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const bolt = mesh(parent, geometry, metal, [
                Math.cos(angle) * radius,
                Math.sin(angle) * radius,
                z,
            ]);
            bolt.rotation.x = Math.PI / 2;
        }
    };
    const surface = document.createElement("canvas");
    surface.width = 256;
    surface.height = 512;
    const ctx = surface.getContext("2d")!;
    ctx.fillStyle = "#aebdc0";
    ctx.fillRect(0, 0, 256, 512);
    for (let y = 0; y < 16; y++)
        for (let x = 0; x < 8; x++) {
            ctx.fillStyle = (x + y) % 4 === 0 ? "#274e70" : "#142c4d";
            ctx.fillRect(x * 32 + 1, y * 32 + 1, 30, 30);
            ctx.fillStyle = "#638ba2";
            ctx.fillRect(x * 32 + 15, y * 32 + 2, 1, 28);
        }
    const cells = new T.CanvasTexture(surface);
    cells.colorSpace = T.SRGBColorSpace;
    textures.push(cells);
    const solar = new T.MeshStandardMaterial({
        map: cells,
        color: 0xb1d3ea,
        metalness: 0.72,
        roughness: 0.28,
    });
    materials.push(solar);
    const wing = (
        parent: T.Object3D,
        x: number,
        y: number,
        z: number,
        scale = 1,
    ) => {
        const group = new T.Group();
        group.position.set(x, y, z);
        group.scale.setScalar(scale);
        parent.add(group);
        box(group, [1.42, 2.16, 0.08], [0, 0, 0], metal);
        box(group, [1.35, 2.08, 0.025], [0, 0, 0.055], solar);
        for (const side of [-1, 1])
            box(group, [0.025, 2.12, 0.08], [side * 0.46, 0, 0.06], dark);
        box(group, [1.42, 0.025, 0.08], [0, 0, 0.06], metal);
        return group;
    };
    const dish = (parent: T.Object3D, radius: number, position: number[]) => {
        const group = new T.Group();
        group.position.fromArray(position);
        parent.add(group);
        const profile = Array.from({ length: 33 }, (_, i) => {
            const r = (radius * i) / 32;
            return new T.Vector2(r, (r * r) / (radius * 2.9));
        });
        const shell = ivory.clone();
        shell.side = T.DoubleSide;
        shell.map = null;
        shell.color.set(0x8d9699);
        shell.metalness = 0.92;
        shell.roughness = 0.32;
        finishSurface(shell);
        materials.push(shell);
        const bowl = mesh(group, new T.LatheGeometry(profile, 80), shell);
        bowl.rotation.x = Math.PI / 2;
        ring(group, radius, 0.022, [0, 0, radius / 2.9], gold);
        for (let i = 0; i < 16; i++) {
            const angle = (i * Math.PI) / 8;
            const curve = new T.CatmullRomCurve3(
                Array.from({ length: 9 }, (_, j) => {
                    const r = (radius * j) / 8;
                    return new T.Vector3(
                        Math.cos(angle) * r,
                        Math.sin(angle) * r,
                        (r * r) / (radius * 2.9) - 0.018,
                    );
                }),
            );
            mesh(group, new T.TubeGeometry(curve, 12, 0.008, 4, false), metal);
        }
        for (let i = 0; i < 3; i++) {
            const angle = (i * Math.PI * 2) / 3;
            strut(
                group,
                [
                    Math.cos(angle) * radius * 0.93,
                    Math.sin(angle) * radius * 0.93,
                    radius / 2.9,
                ],
                [0, 0, radius * 0.8],
                0.018,
            );
        }
        const feed = tube(group, 0.09, 0.22, [0, 0, radius * 0.77], gold);
        feed.rotation.x = Math.PI / 2;
        return group;
    };
    const truss = (
        parent: T.Object3D,
        from: number[],
        to: number[],
        width = 0.16,
    ) => {
        const a = new T.Vector3().fromArray(from),
            b = new T.Vector3().fromArray(to);
        const direction = b.clone().sub(a).normalize();
        const offset = new T.Vector3(0, 1, 0)
            .cross(direction)
            .normalize()
            .multiplyScalar(width);
        for (const sign of [-1, 1])
            strut(
                parent,
                a.clone().addScaledVector(offset, sign).toArray(),
                b.clone().addScaledVector(offset, sign).toArray(),
                0.024,
            );
        const steps = Math.max(3, Math.ceil(a.distanceTo(b) / 0.35));
        for (let i = 0; i < steps; i++)
            strut(
                parent,
                a
                    .clone()
                    .lerp(b, i / steps)
                    .addScaledVector(offset, i % 2 ? 1 : -1)
                    .toArray(),
                a
                    .clone()
                    .lerp(b, (i + 1) / steps)
                    .addScaledVector(offset, i % 2 ? -1 : 1)
                    .toArray(),
                0.012,
                gold,
            );
    };
    let moving: T.Object3D | undefined;
    if (kind === "workshop") {
        // The dry dock is loaded before the first frame below.
    } else if (kind === "observatory") {
        // The detailed NASA telescope is loaded before the first frame below.
    } else if (kind === "robotics") {
        moving = makePerceptionArm({
            root,
            ivory,
            metal,
            gold,
            dark,
            amber,
            light,
            materials,
            textures,
            mesh,
            box,
            tube,
            ring,
            strut,
            bolts,
        });
    } else {
        moving = makeRelay({
            root,
            ivory,
            metal,
            gold,
            dark,
            amber,
            light,
            foil,
            solar,
            materials,
            textures,
            mesh,
            box,
            tube,
            ring,
            strut,
            bolts,
            wing,
            dish,
            truss,
        });
    }
    // Bake rigid parts by material, retaining only the moving subassembly.
    // Hundreds of small fasteners and panels cost a handful of draw calls.
    const batch = (group: T.Group, excluded?: T.Object3D) => {
        root.updateMatrixWorld(true);
        const inverse = group.matrixWorld.clone().invert();
        const buckets = new Map<
            T.Material,
            { geometries: T.BufferGeometry[]; objects: T.Mesh[] }
        >();
        const visit = (object: T.Object3D) => {
            if (object === excluded) return;
            if (object instanceof T.Mesh && !Array.isArray(object.material)) {
                const geometry = object.geometry.index
                    ? object.geometry.toNonIndexed()
                    : object.geometry.clone();
                geometry.applyMatrix4(
                    inverse.clone().multiply(object.matrixWorld),
                );
                for (const name of Object.keys(geometry.attributes))
                    if (!["position", "normal", "uv"].includes(name))
                        geometry.deleteAttribute(name);
                if (!geometry.getAttribute("uv"))
                    geometry.setAttribute(
                        "uv",
                        new T.Float32BufferAttribute(
                            new Float32Array(
                                geometry.getAttribute("position").count * 2,
                            ),
                            2,
                        ),
                    );
                const bucket = buckets.get(object.material) || {
                    geometries: [],
                    objects: [],
                };
                bucket.geometries.push(geometry);
                bucket.objects.push(object);
                buckets.set(object.material, bucket);
            }
            object.children.forEach(visit);
        };
        group.children.forEach(visit);
        for (const [material, bucket] of buckets) {
            const geometry = mergeGeometries(bucket.geometries, false);
            bucket.geometries.forEach((g) => g.dispose());
            if (!geometry) continue;
            bucket.objects.forEach((m) => m.removeFromParent());
            mesh(group, geometry, material);
        }
    };
    if (moving instanceof T.Group) batch(moving);
    batch(root, moving);
    const reclaimSources = () => {
        const used = new Set<T.BufferGeometry>();
        root.traverse((object) => {
            if (object instanceof T.Mesh) used.add(object.geometry);
        });
        for (const geometry of geometries)
            if (!used.has(geometry)) {
                geometry.dispose();
                geometries.delete(geometry);
            }
    };
    reclaimSources();
    let disposed = false;
    let turning: ((time: number) => void) | undefined;
    const dock = async () => {
        const { loadOrbitalWorkshop } = await import("./study-workshop");
        const made = await loadOrbitalWorkshop(
            detail.anisotropy ?? 1,
            detail.lite ?? false,
        );
        if (disposed) {
            made.geometries.forEach((g) => g.dispose());
            made.materials.forEach((m) => m.dispose());
            made.textures.forEach((t) => t.dispose());
            return;
        }
        made.geometries.forEach((g) => geometries.add(g));
        materials.push(...made.materials);
        textures.push(...made.textures);
        root.add(made.asset);
        // Seen from ahead and to starboard, a little above the keel. Beside
        // the page's heading on a wide screen; on a narrow one it has the
        // width to itself, and is set back until both arrays are inside it.
        root.rotation.set(0.1, -0.5, 0.03);
        const narrow = matchMedia("(max-width: 800px)");
        let placed: boolean | undefined;
        const place = () => {
            if (placed === narrow.matches) return;
            placed = narrow.matches;
            root.position.set(placed ? 0 : 0.9, 0.15, 0);
            root.scale.setScalar(placed ? 0.9 : 1);
        };
        turning = (time) => {
            place();
            made.update(time);
        };
        turning(0);
    };
    const ready =
        kind === "workshop"
            ? dock()
            : kind === "observatory"
              ? (async () => {
                    const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all(
                        [
                            import("three/addons/loaders/GLTFLoader.js"),
                            import("three/addons/loaders/DRACOLoader.js"),
                        ],
                    );
                    const decoder = new DRACOLoader();
                    decoder.setDecoderPath("/draco/");
                    decoder.setDecoderConfig({ type: "js" });
                    const loader = new GLTFLoader().setDRACOLoader(decoder);
                    try {
                        const { scene: asset } = await loader.loadAsync(
                            "/models/webb-observatory-v1.glb",
                        );
                        finishWebbSurfaces(asset);
                        const detached = new Set<T.Texture>();
                        asset.traverse((object) => {
                            if (!(object instanceof T.Mesh)) return;
                            geometries.add(object.geometry);
                            for (const material of Array.isArray(
                                object.material,
                            )
                                ? object.material
                                : [object.material]) {
                                if (
                                    material instanceof T.MeshStandardMaterial
                                ) {
                                    const name = material.name.toLowerCase();
                                    // The file bakes a self-lit emissive colour into most
                                    // materials, which flattens the model. None of the
                                    // overrides below is meant to glow.
                                    if (material.emissiveMap)
                                        detached.add(material.emissiveMap);
                                    material.emissiveMap = null;
                                    material.emissive.setRGB(0, 0, 0);
                                    if (name.includes("mirror")) {
                                        material.color.set(0xe2a947);
                                        material.metalness = 0.98;
                                        material.roughness = 0.26;
                                        material.bumpMap = foilRelief;
                                        material.bumpScale = 0;
                                    } else if (/silv|smli/.test(name)) {
                                        material.color.set(0x969da6);
                                        material.metalness = 0.98;
                                        material.roughness = 0.22;
                                        material.bumpMap = foilRelief;
                                        material.bumpScale = 0.004;
                                    } else if (
                                        /pink|pnkmli|pmli|gold/.test(name)
                                    ) {
                                        material.color.set(
                                            /gold/.test(name)
                                                ? 0xac8441
                                                : 0x9b8d84,
                                        );
                                        material.metalness = 0.65;
                                        material.roughness = 0.44;
                                    } else if (
                                        /black|blk|carbon|graphite/.test(name)
                                    ) {
                                        material.color.set(0x1a2429);
                                        material.metalness = 0.35;
                                        material.roughness = 0.5;
                                    } else if (/alu|ssm/.test(name)) {
                                        material.color.set(0x929da3);
                                        material.metalness = 0.92;
                                        material.roughness = 0.28;
                                    } else if (/sacells/.test(name)) {
                                        material.map = cells;
                                        material.color.set(0x84a3c5);
                                        material.metalness = 0.55;
                                        material.roughness = 0.4;
                                    }
                                    material.side = T.DoubleSide;
                                    materials.push(material);
                                }
                            }
                        });
                        // Free detached emissive maps unless another slot still uses them.
                        for (const texture of detached) {
                            const used = materials.some((material) =>
                                Object.values(material).includes(texture),
                            );
                            if (!used) texture.dispose();
                        }
                        if (disposed) {
                            geometries.forEach((g) => g.dispose());
                            materials.forEach((m) => m.dispose());
                            return;
                        }
                        root.clear();
                        asset.rotation.y = -Math.PI / 2;
                        asset.updateMatrixWorld(true);
                        const bounds = new T.Box3().setFromObject(asset);
                        const size = bounds.getSize(new T.Vector3()),
                            center = bounds.getCenter(new T.Vector3());
                        const scale = 8.5 / Math.max(size.x, size.y, size.z);
                        asset.scale.setScalar(scale);
                        asset.position.copy(center).multiplyScalar(-scale);
                        root.add(asset);
                        root.rotation.set(0.08, -0.65, -0.05);
                        root.position.x = 1.15;
                        root.scale.setScalar(1.32);
                        batch(root);
                        reclaimSources();
                    } finally {
                        decoder.dispose();
                    }
                })()
              : Promise.resolve();
    return {
        root,
        ready,
        update(time: number) {
            if (kind === "workshop") turning?.(time);
            if (kind === "robotics" && moving)
                moving.rotation.y = Math.sin(time * 0.16) * 0.14;
            if (kind === "relay" && moving)
                moving.rotation.y = Math.sin(time * 0.12) * 0.08;
        },
        dispose() {
            disposed = true;
            geometries.forEach((g) => g.dispose());
            materials.forEach((m) => m.dispose());
            textures.forEach((t) => t.dispose());
        },
    };
}
