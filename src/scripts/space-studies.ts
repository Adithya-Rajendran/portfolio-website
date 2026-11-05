import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export type SpaceStudy = "workshop" | "observatory" | "robotics" | "relay";

/** Original instruments, built in metres with shared materials and reusable parts. */
export function makeSpaceStudy(kind: SpaceStudy) {
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
    const glass = new T.MeshPhysicalMaterial({
        color: 0x153d51,
        metalness: 0.72,
        roughness: 0.08,
        clearcoat: 1,
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
    const textures: T.Texture[] = [];
    const materials = [ivory, metal, gold, dark, glass, light, amber];
    // The same physical panel pattern carries seams, fasteners and wear into
    // every hull. All imagery here is generated from deterministic JS.
    const hullCanvas = document.createElement("canvas");
    hullCanvas.width = hullCanvas.height = 512;
    const hull = hullCanvas.getContext("2d")!;
    hull.fillStyle = "#c4c6bf";
    hull.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
            const px = x * 128,
                py = y * 128;
            hull.fillStyle = (x + y) % 3 ? "#c7c9c1" : "#a8aca7";
            hull.fillRect(px + 3, py + 3, 122, 122);
            hull.strokeStyle = "#606969";
            hull.lineWidth = 1.5;
            hull.strokeRect(px + 4, py + 4, 120, 120);
            for (const sx of [10, 118])
                for (const sy of [10, 118]) {
                    hull.fillStyle = "#465153";
                    hull.beginPath();
                    hull.arc(px + sx, py + sy, 2, 0, Math.PI * 2);
                    hull.fill();
                }
            hull.fillStyle = "#515e5e";
            hull.fillRect(px + 20, py + 90, 30, 3);
            hull.fillRect(px + 20, py + 97, 18, 2);
            hull.fillStyle = "#b48548";
            if (y === 2) hull.fillRect(px + 3, py + 32, 122, 8);
        }
    const hullMap = new T.CanvasTexture(hullCanvas);
    hullMap.colorSpace = T.SRGBColorSpace;
    hullMap.wrapS = hullMap.wrapT = T.RepeatWrapping;
    textures.push(hullMap);
    if (kind !== "robotics") ivory.map = hullMap;
    const windowMaterial = new T.MeshStandardMaterial({
        color: 0x704e28,
        metalness: 0.25,
        roughness: 0.26,
        emissive: 0xdfaa69,
        emissiveIntensity: 1.8,
    });
    materials.push(windowMaterial);
    const opticCanvas = document.createElement("canvas");
    opticCanvas.width = opticCanvas.height = 256;
    const optic = opticCanvas.getContext("2d")!;
    const tint = optic.createRadialGradient(105, 95, 8, 128, 128, 125);
    tint.addColorStop(0, "#18394c");
    tint.addColorStop(0.45, "#071521");
    tint.addColorStop(0.8, "#2d424a");
    tint.addColorStop(1, "#050b0e");
    optic.fillStyle = tint;
    optic.fillRect(0, 0, 256, 256);
    optic.strokeStyle = "#b3d5de";
    optic.lineWidth = 2;
    optic.beginPath();
    optic.arc(128, 128, 100, Math.PI * 1.1, Math.PI * 1.65);
    optic.stroke();
    optic.strokeStyle = "#c8a477";
    optic.lineWidth = 5;
    optic.beginPath();
    optic.arc(128, 128, 104, 0.3, 1.4);
    optic.stroke();
    const opticMap = new T.CanvasTexture(opticCanvas);
    opticMap.colorSpace = T.SRGBColorSpace;
    textures.push(opticMap);
    glass.map = opticMap;
    glass.color.set(0xffffff);
    glass.metalness = 0.28;
    const relief = new Uint8Array(128 * 128);
    for (let y = 0; y < 128; y++)
        for (let x = 0; x < 128; x++)
            relief[y * 128 + x] =
                128 +
                45 * Math.sin(x * 0.4 + Math.sin(y * 0.23) * 2) +
                22 * Math.sin(y * 0.31 + Math.sin(x * 0.19));
    const foilRelief = new T.DataTexture(relief, 128, 128, T.RedFormat);
    foilRelief.wrapS = foilRelief.wrapT = T.RepeatWrapping;
    foilRelief.needsUpdate = true;
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
                2,
                Math.min(...size) * 0.12,
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
            new T.TorusGeometry(radius, thickness, 12, 80),
            material,
            position,
        );
    const strut = (
        parent: T.Object3D,
        from: number[],
        to: number[],
        radius: number,
        material = metal,
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
        const ringwork = new T.Group();
        root.add(ringwork);
        moving = ringwork;
        ring(ringwork, 1.7, 0.25, [0, 0, -0.25], ivory);
        ring(ringwork, 1.7, 0.018, [0, 0, 0.005], gold);
        ring(ringwork, 1.7, 0.018, [0, 0, -0.505], metal);
        for (let i = 0; i < 16; i++) {
            const angle = (i * Math.PI) / 8,
                x = Math.cos(angle) * 1.7,
                y = Math.sin(angle) * 1.7;
            if (i % 2 === 0)
                truss(ringwork, [0, 0, -0.25], [x, y, -0.25], 0.075);
            const module = new T.Group();
            module.position.set(x, y, -0.25);
            module.rotation.z = angle - Math.PI / 2;
            ringwork.add(module);
            const collar = ring(module, 0.257, 0.022, [0, 0, 0], metal);
            collar.rotation.y = Math.PI / 2;
            for (const sign of [-1, 1]) {
                box(module, [0.18, 0.16, 0.045], [sign * 0.18, 0, 0.238], dark);
                box(
                    module,
                    [0.145, 0.1, 0.015],
                    [sign * 0.18, 0, 0.264],
                    windowMaterial,
                );
                box(
                    module,
                    [0.014, 0.12, 0.025],
                    [sign * 0.18, 0, 0.276],
                    metal,
                );
            }
            box(module, [0.16, 0.1, 0.14], [0, 0.28, -0.06], dark);
            box(module, [0.08, 0.02, 0.05], [0, 0.338, -0.06], amber);
        }
        const core = tube(root, 0.56, 2.2, [0, 0, 0.25], ivory);
        core.rotation.x = Math.PI / 2;
        for (const z of [-0.85, -0.4, 0.2, 0.8, 1.36])
            ring(root, 0.565, 0.04, [0, 0, z], metal);
        const port = tube(root, 0.47, 0.06, [0, 0, 1.4], dark);
        port.rotation.x = Math.PI / 2;
        ring(root, 0.47, 0.045, [0, 0, 1.44], gold);
        ring(root, 0.37, 0.02, [0, 0, 1.46], metal);
        bolts(root, 0.52, 1.43, 12);
        for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI) / 4;
            box(
                root,
                [0.055, 0.055, 0.025],
                [Math.cos(a) * 0.44, Math.sin(a) * 0.44, 1.48],
                i % 2 ? amber : light,
            );
            const housing = box(
                root,
                [0.2, 0.12, 0.4],
                [Math.cos(a) * 0.57, Math.sin(a) * 0.57, 0.5],
                dark,
            );
            housing.rotation.z = a - Math.PI / 2;
        }
        for (const side of [-1, 1]) {
            truss(root, [0, 0, -1], [side * 4.25, 0, -1], 0.18);
            for (let i = 0; i < 2; i++)
                wing(root, side * (2.7 + i * 1.48), 0, -1.03, 1);
            box(root, [0.48, 0.65, 0.5], [side * 0.65, 0, -0.8], foil);
            dish(root, 0.32, [side * 0.75, -0.7, 0.55]);
            // Radiator fins, structurally attached below the central service bus.
            box(root, [1.25, 0.8, 0.055], [side * 0.8, -1.05, -0.85], ivory);
            for (let j = 0; j < 12; j++)
                box(
                    root,
                    [0.018, 0.76, 0.04],
                    [side * 0.8 - 0.55 + j * 0.1, -1.05, -0.8],
                    metal,
                );
        }
        truss(root, [0, 0.4, -0.7], [0, 2.05, -0.7], 0.12);
        mesh(root, new T.SphereGeometry(0.27, 24, 16), ivory, [0, 2.05, -0.7]);
        for (const side of [-1, 1]) {
            strut(
                root,
                [side * 0.65, 0.3, -0.8],
                [side * 0.65, 1.65, -0.8],
                0.018,
            );
            box(root, [0.05, 0.07, 0.05], [side * 0.65, 1.65, -0.8], light);
        }
        root.rotation.set(0.87, -0.55, 0.12);
        root.scale.setScalar(0.94);
    } else if (kind === "observatory") {
        // The detailed NASA telescope is loaded before the first frame below.
    } else if (kind === "robotics") {
        tube(root, 2.3, 0.16, [0, -1.83, 0], dark, 96);
        tube(root, 2.26, 0.055, [0, -1.73, 0], metal, 96);
        for (const radius of [1.35, 1.85, 2.2]) {
            const track = ring(root, radius, 0.012, [0, -1.69, 0], gold);
            track.rotation.x = Math.PI / 2;
        }
        for (let i = 0; i < 32; i++) {
            const a = (i * Math.PI) / 16;
            const marker = box(
                root,
                [0.025, 0.008, 0.13],
                [Math.cos(a) * 2.07, -1.695, Math.sin(a) * 2.07],
                i % 4 ? dark : amber,
            );
            marker.rotation.y = -a + Math.PI / 2;
        }
        const checkerCanvas = document.createElement("canvas");
        checkerCanvas.width = checkerCanvas.height = 128;
        const checker = checkerCanvas.getContext("2d")!;
        for (let y = 0; y < 8; y++)
            for (let x = 0; x < 8; x++) {
                checker.fillStyle = (x + y) % 2 ? "#c7c6b8" : "#152127";
                checker.fillRect(x * 16, y * 16, 16, 16);
            }
        const checkerMap = new T.CanvasTexture(checkerCanvas);
        checkerMap.colorSpace = T.SRGBColorSpace;
        textures.push(checkerMap);
        const calibration = new T.MeshStandardMaterial({
            map: checkerMap,
            roughness: 0.8,
        });
        materials.push(calibration);
        const target = box(
            root,
            [0.55, 0.55, 0.04],
            [-1.45, -1.38, 0.7],
            calibration,
        );
        target.rotation.x = -0.15;
        for (const x of [-1.45, 1.5])
            box(root, [0.62, 0.08, 0.5], [x, -1.64, 0.7], dark);
        mesh(
            root,
            new T.IcosahedronGeometry(0.22, 1),
            metal,
            [1.5, -1.38, 0.7],
        );
        box(root, [0.32, 0.32, 0.32], [0.6, -1.49, 1.5], ivory);
        tube(root, 1.05, 0.17, [0, -1.65, 0], dark, 8);
        const baseRing = ring(root, 0.88, 0.045, [0, -1.53, 0], gold);
        baseRing.rotation.x = Math.PI / 2;
        tube(root, 0.55, 0.4, [0, -1.35, 0], ivory);
        tube(root, 0.59, 0.08, [0, -1.1, 0], dark);
        for (let i = 0; i < 12; i++) {
            const angle = (i * Math.PI) / 6;
            const vent = box(
                root,
                [0.12, 0.16, 0.045],
                [Math.cos(angle) * 0.55, -1.35, Math.sin(angle) * 0.55],
                dark,
            );
            vent.rotation.y = Math.PI / 2 - angle;
        }
        for (const side of [-1, 1]) {
            box(root, [0.21, 0.14, 0.25], [side * 0.73, -1.59, 0.35], ivory);
            box(root, [0.12, 0.022, 0.035], [side * 0.73, -1.5, 0.48], light);
        }
        const points = [
            [0, -1.1, 0],
            [-0.65, 0.1, 0],
            [0.35, 1.05, 0],
            [0.8, 1.2, 0],
        ];
        for (let i = 0; i < points.length - 1; i++) {
            strut(root, points[i], points[i + 1], i === 0 ? 0.17 : 0.14, ivory);
            const a = new T.Vector3().fromArray(points[i]),
                b = new T.Vector3().fromArray(points[i + 1]);
            for (const side of [-1, 1]) {
                const plate = box(
                    root,
                    [i === 0 ? 0.34 : 0.3, a.distanceTo(b) - 0.17, 0.09],
                    a
                        .clone()
                        .lerp(b, 0.5)
                        .add(new T.Vector3(0, 0, side * 0.18))
                        .toArray(),
                    ivory,
                );
                plate.quaternion.setFromUnitVectors(
                    new T.Vector3(0, 1, 0),
                    b.clone().sub(a).normalize(),
                );
            }
            strut(
                root,
                a
                    .lerp(b, 0.15)
                    .add(new T.Vector3(0, 0, -0.17))
                    .toArray(),
                new T.Vector3()
                    .fromArray(points[i])
                    .lerp(b, 0.85)
                    .add(new T.Vector3(0, 0, -0.17))
                    .toArray(),
                0.055,
                gold,
            );
        }
        for (const at of points) {
            const joint = new T.Group();
            joint.position.fromArray(at);
            root.add(joint);
            const housing = tube(joint, 0.25, 0.36, [0, 0, 0], dark);
            housing.rotation.x = Math.PI / 2;
            ring(joint, 0.2, 0.045, [0, 0, 0.2], gold);
            bolts(joint, 0.16, 0.22, 6);
        }
        strut(root, [-0.32, -0.91, 0.18], [-0.88, -0.02, 0.18], 0.075, dark);
        strut(root, [-0.88, -0.02, 0.18], [-0.64, 0.18, 0.18], 0.04, metal);
        strut(root, [-0.4, 0.08, -0.24], [0.32, 0.77, -0.24], 0.06, dark);
        strut(root, [0.32, 0.77, -0.24], [0.38, 1.05, -0.24], 0.035, metal);
        const head = new T.Group();
        head.position.set(0.8, 1.32, 0.12);
        root.add(head);
        moving = head;
        box(head, [1.55, 0.68, 0.68], [0, 0.18, 0], ivory);
        box(head, [1.22, 0.4, 0.03], [0, 0.18, 0.33], dark);
        for (const x of [-0.64, 0.64])
            for (const y of [-0.02, 0.38]) {
                const screw = tube(head, 0.025, 0.025, [x, y, 0.34], metal, 6);
                screw.rotation.x = Math.PI / 2;
            }
        for (const x of [-0.37, 0.37]) {
            for (const [radius, z, material] of [
                [0.22, 0.35, metal],
                [0.18, 0.43, dark],
                [0.145, 0.48, glass],
            ] as const) {
                const lens = tube(head, radius, 0.065, [x, 0.18, z], material);
                lens.rotation.x = Math.PI / 2;
            }
            ring(head, 0.153, 0.012, [x, 0.18, 0.52], gold);
            for (const z of [0.37, 0.405, 0.445])
                ring(head, 0.19, 0.008, [x, 0.18, z], metal);
            mesh(head, new T.SphereGeometry(0.028, 12, 8), light, [
                x - 0.045,
                0.23,
                0.525,
            ]);
        }
        for (let i = 0; i < 5; i++)
            box(head, [0.03, 0.2, 0.03], [0.67, 0.17, -0.2 + i * 0.08], dark);
        box(head, [0.12, 0.03, 0.03], [0, 0.42, 0.2], light);
        box(head, [0.58, 0.14, 0.3], [0, 0.59, -0.02], dark);
        box(head, [0.34, 0.025, 0.03], [0, 0.6, 0.14], amber);
        for (let i = 0; i < 7; i++) {
            const bellows = ring(
                head,
                0.19,
                0.024,
                [0, -0.18 - i * 0.035, -0.1],
                dark,
            );
            bellows.rotation.x = Math.PI / 2;
        }
        const cable = new T.CatmullRomCurve3([
            new T.Vector3(0, -1.4, -0.2),
            new T.Vector3(-0.95, -0.1, -0.15),
            new T.Vector3(-0.35, 0.65, -0.25),
            new T.Vector3(0.35, 0.9, -0.25),
            new T.Vector3(0.8, 1.3, -0.2),
        ]);
        mesh(root, new T.TubeGeometry(cable, 48, 0.045, 8, false), dark);
        root.rotation.set(0, -0.36, 0);
        root.scale.setScalar(1.06);
    } else {
        box(root, [1.2, 1, 1.1], [0, -0.55, -0.3], foil);
        for (const x of [-0.62, 0.62])
            for (const y of [-1.06, -0.03])
                strut(root, [x, y, -0.87], [x, y, 0.28], 0.04);
        box(root, [1.3, 0.08, 1.2], [0, -1.1, -0.3], ivory);
        box(root, [1.3, 0.06, 1.2], [0, -0.02, -0.3], dark);
        for (const side of [-1, 1]) {
            const radiator = box(
                root,
                [0.05, 0.72, 0.83],
                [side * 0.67, -0.56, -0.3],
                ivory,
            );
            radiator.rotation.z = side * 0.12;
            for (let i = 0; i < 8; i++)
                box(
                    root,
                    [0.025, 0.018, 0.79],
                    [side * 0.704, -0.85 + i * 0.09, -0.3],
                    metal,
                );
            strut(
                root,
                [side * 0.56, -0.85, 0.24],
                [side * 0.7, -0.2, 0.35],
                0.022,
                gold,
            );
        }
        const antenna = dish(root, 1.15, [0, 0.3, 0.1]);
        antenna.rotation.x = -0.16;
        moving = antenna;
        truss(root, [-3.15, -0.7, -0.4], [3.15, -0.7, -0.4], 0.08);
        for (const side of [-1, 1]) {
            for (let i = 0; i < 3; i++) {
                wing(root, side * (1.25 + i * 0.98), -0.7, -0.4, 0.65);
                box(
                    root,
                    [0.12, 0.16, 0.17],
                    [side * (0.77 + i * 0.98), -0.7, -0.4],
                    gold,
                );
            }
            const thruster = tube(
                root,
                0.14,
                0.3,
                [side * 0.45, -1.25, -0.3],
                dark,
            );
            thruster.rotation.z = side * 0.2;
        }
        strut(root, [0.45, -0.05, -0.65], [0.45, 1.6, -0.65], 0.025);
        mesh(
            root,
            new T.SphereGeometry(0.055, 16, 12),
            amber,
            [0.45, 1.6, -0.65],
        );
        root.rotation.set(0.1, -0.33, 0.19);
        root.scale.setScalar(0.85);
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
    let disposed = false;
    const ready =
        kind === "observatory"
            ? (async () => {
                  const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
                      import("three/addons/loaders/GLTFLoader.js"),
                      import("three/addons/loaders/DRACOLoader.js"),
                  ]);
                  const decoder = new DRACOLoader();
                  decoder.setDecoderPath("/draco/");
                  decoder.setDecoderConfig({ type: "js" });
                  const loader = new GLTFLoader().setDRACOLoader(decoder);
                  try {
                      const { scene: asset } = await loader.loadAsync(
                          "/models/webb-observatory-v1.glb",
                      );
                      asset.traverse((object) => {
                          if (!(object instanceof T.Mesh)) return;
                          geometries.add(object.geometry);
                          for (const material of Array.isArray(object.material)
                              ? object.material
                              : [object.material]) {
                              if (material instanceof T.MeshStandardMaterial) {
                                  const name = material.name.toLowerCase();
                                  if (name.includes("mirror")) {
                                      material.color.set(0xe9b959);
                                      material.metalness = 0.72;
                                      material.roughness = 0.28;
                                      material.bumpMap = foilRelief;
                                      material.bumpScale = 0.001;
                                  } else if (/silv|smli/.test(name)) {
                                      material.color.set(0xa6adb2);
                                      material.metalness = 0.75;
                                      material.roughness = 0.4;
                                      material.bumpMap = foilRelief;
                                      material.bumpScale = 0.008;
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
                      root.rotation.set(0.12, 0.42, -0.06);
                      root.position.x = 0.65;
                      root.scale.setScalar(1.15);
                      batch(root);
                  } finally {
                      decoder.dispose();
                  }
              })()
            : Promise.resolve();
    return {
        root,
        ready,
        update(time: number) {
            if (kind === "workshop" && moving) moving.rotation.z = time * 0.035;
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
