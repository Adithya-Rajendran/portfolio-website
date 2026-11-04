import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export type SpaceStudy = "workshop" | "observatory" | "robotics" | "relay";

/** Original instruments, built in metres with shared materials and reusable parts. */
export function makeSpaceStudy(kind: SpaceStudy) {
    const root = new T.Group();
    const ivory = new T.MeshStandardMaterial({
        color: 0xe4dfcd,
        metalness: 0.35,
        roughness: 0.34,
    });
    const metal = new T.MeshStandardMaterial({
        color: 0x9cabb7,
        metalness: 0.9,
        roughness: 0.25,
    });
    const gold = new T.MeshStandardMaterial({
        color: 0xd9a457,
        metalness: 0.85,
        roughness: 0.27,
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
    ) =>
        mesh(
            parent,
            new RoundedBoxGeometry(...size, 2, Math.min(...size) * 0.18),
            material,
            position,
        );
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
    let moving: T.Object3D | undefined;
    if (kind === "workshop") {
        const ringwork = new T.Group();
        root.add(ringwork);
        moving = ringwork;
        ring(ringwork, 1.15, 0.1, [0, 0, 0], metal);
        ring(ringwork, 1.25, 0.025, [0, 0, 0], amber);
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4,
                x = Math.cos(angle) * 1.15,
                y = Math.sin(angle) * 1.15;
            strut(ringwork, [0, 0, 0], [x, y, 0], 0.055);
            const module = new T.Group();
            module.position.set(x, y, 0);
            module.rotation.z = angle - Math.PI / 2;
            ringwork.add(module);
            tube(module, 0.22, 0.7, [0, 0, 0], ivory);
            for (const sign of [-1, 1]) {
                tube(module, 0.23, 0.055, [0, sign * 0.28, 0], gold);
                box(module, [0.24, 0.1, 0.02], [0, sign * 0.15, 0.217], glass);
            }
            box(module, [0.14, 0.025, 0.01], [0, 0, 0.231], light);
        }
        const core = tube(root, 0.42, 1.4, [0, 0, 0.1], ivory);
        core.rotation.x = Math.PI / 2;
        for (const z of [-0.62, 0.6, 0.82])
            ring(root, 0.42, 0.055, [0, 0, z], metal);
        const port = tube(root, 0.32, 0.05, [0, 0, 0.84], dark);
        port.rotation.x = Math.PI / 2;
        ring(root, 0.27, 0.02, [0, 0, 0.89], amber);
        bolts(root, 0.37, 0.89);
        for (const side of [-1, 1]) {
            strut(root, [0, 0, -0.65], [side * 3.3, 0, -0.65], 0.065);
            for (let i = 0; i < 2; i++)
                wing(root, side * (2.05 + i * 1.5), 0, -0.65);
            box(root, [0.55, 0.65, 0.5], [side * 0.65, 0, -0.55], gold);
            dish(root, 0.35, [side * 0.75, -0.8, 0.25]);
        }
        root.rotation.set(0.24, -0.55, 0.17);
        root.scale.setScalar(0.8);
    } else if (kind === "observatory") {
        const mirror = new T.Group();
        root.add(mirror);
        const mirrorMaterial = new T.MeshStandardMaterial({
            color: 0xf0c077,
            metalness: 0.94,
            roughness: 0.17,
        });
        materials.push(mirrorMaterial);
        for (let q = -2; q <= 2; q++)
            for (let r = -2; r <= 2; r++) {
                if (Math.abs(q + r) > 2 || (q === 0 && r === 0)) continue;
                const x = Math.sqrt(3) * 0.39 * (q + r / 2),
                    y = 0.39 * 1.5 * r;
                const tile = mesh(
                    mirror,
                    new T.CylinderGeometry(0.38, 0.38, 0.07, 6),
                    mirrorMaterial,
                    [x, y, 0.04 * (x * x + y * y)],
                );
                tile.rotation.set(Math.PI / 2 + y * 0.035, 0, -x * 0.035);
            }
        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2 + Math.PI / 2;
            strut(
                mirror,
                [Math.cos(angle) * 1.45, Math.sin(angle) * 1.45, 0],
                [0, 0, 1.1],
                0.035,
                dark,
            );
        }
        const secondary = tube(mirror, 0.18, 0.13, [0, 0, 1.1], dark);
        secondary.rotation.x = Math.PI / 2;
        ring(mirror, 0.14, 0.018, [0, 0, 1.18], gold);
        for (let i = 0; i < 5; i++) {
            const shieldMaterial = new T.MeshStandardMaterial({
                color: i % 2 ? 0xad8379 : 0xbab6ae,
                metalness: 0.85,
                roughness: 0.28,
                side: T.DoubleSide,
                bumpMap: foilRelief,
                bumpScale: 0.014,
            });
            materials.push(shieldMaterial);
            const shield = mesh(
                root,
                new T.CylinderGeometry(
                    1.9 + i * 0.09,
                    1.9 + i * 0.09,
                    0.018,
                    6,
                ),
                shieldMaterial,
                [0, -1.05, -0.6 - i * 0.12],
            );
            shield.rotation.x = Math.PI / 2;
            shield.scale.y = 1;
            shield.scale.z = 0.55;
        }
        box(root, [0.7, 0.8, 0.6], [0, -1, -1.3], foil);
        wing(root, -1.65, -1.5, -1.1, 0.62);
        dish(root, 0.3, [0.8, -1.2, -0.7]);
        root.rotation.set(0.22, -0.6, 0.15);
        root.scale.setScalar(1.12);
    } else if (kind === "robotics") {
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
        box(head, [1.45, 0.58, 0.62], [0, 0.18, 0], ivory);
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
            mesh(head, new T.SphereGeometry(0.028, 12, 8), light, [
                x - 0.045,
                0.23,
                0.525,
            ]);
        }
        for (let i = 0; i < 5; i++)
            box(head, [0.03, 0.2, 0.03], [0.67, 0.17, -0.2 + i * 0.08], dark);
        box(head, [0.12, 0.03, 0.03], [0, 0.42, 0.2], light);
        const cable = new T.CatmullRomCurve3([
            new T.Vector3(0, -1.4, -0.2),
            new T.Vector3(-0.95, -0.1, -0.15),
            new T.Vector3(-0.35, 0.65, -0.25),
            new T.Vector3(0.35, 0.9, -0.25),
            new T.Vector3(0.8, 1.3, -0.2),
        ]);
        mesh(root, new T.TubeGeometry(cable, 48, 0.045, 8, false), dark);
        root.rotation.set(0.1, -0.5, -0.08);
        root.scale.setScalar(1.15);
    } else {
        box(root, [1.2, 1, 1.1], [0, -0.55, -0.3], foil);
        for (const x of [-0.62, 0.62])
            for (const y of [-1.06, -0.03])
                strut(root, [x, y, -0.87], [x, y, 0.28], 0.04);
        box(root, [1.3, 0.08, 1.2], [0, -1.1, -0.3], ivory);
        const antenna = dish(root, 1.15, [0, 0.3, 0.1]);
        antenna.rotation.x = -0.16;
        moving = antenna;
        strut(root, [-2.8, -0.7, -0.4], [2.8, -0.7, -0.4], 0.055);
        for (const side of [-1, 1]) {
            for (let i = 0; i < 2; i++)
                wing(root, side * (1.4 + i * 1.1), -0.7, -0.4, 0.7);
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
        root.scale.setScalar(0.95);
    }
    return {
        root,
        update(time: number) {
            if (kind === "workshop" && moving) moving.rotation.z = time * 0.035;
            if (kind === "robotics" && moving)
                moving.rotation.y = Math.sin(time * 0.16) * 0.14;
            if (kind === "relay" && moving)
                moving.rotation.y = Math.sin(time * 0.12) * 0.08;
        },
        dispose() {
            geometries.forEach((g) => g.dispose());
            materials.forEach((m) => m.dispose());
            textures.forEach((t) => t.dispose());
        },
    };
}
