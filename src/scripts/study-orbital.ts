import * as T from "three";
import type { MachineryKit } from "./study-robotics";

export interface OrbitalKit extends MachineryKit {
    foil: T.MeshStandardMaterial;
    solar: T.MeshStandardMaterial;
    wing: (
        parent: T.Object3D,
        x: number,
        y: number,
        z: number,
        scale?: number,
    ) => T.Group;
    dish: (parent: T.Object3D, radius: number, position: number[]) => T.Group;
    truss: (
        parent: T.Object3D,
        from: number[],
        to: number[],
        width?: number,
    ) => void;
}

/** A deep-space communications bus, with a curved reflector and real back structure. */
export function makeRelay(k: OrbitalKit) {
    const {
        root,
        ivory,
        metal,
        gold,
        dark,
        foil,
        amber,
        light,
        mesh,
        box,
        tube,
        ring,
        strut,
        wing,
        dish,
        truss,
    } = k;
    const radiator = ivory.clone();
    radiator.map = null;
    radiator.color.set(0xd0cdbb);
    radiator.metalness = 0.25;
    radiator.roughness = 0.55;
    k.materials.push(radiator);
    const bus = box(root, [1.4, 1.3, 1.25], [0, -0.52, -0.25], foil);
    const pos = bus.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i),
            y = pos.getY(i),
            z = pos.getZ(i);
        const wrinkle =
            0.008 * Math.sin(x * 77 + y * 43) * Math.sin(z * 61 + y * 33);
        pos.setXYZ(i, x + wrinkle, y + wrinkle, z + wrinkle);
    }
    bus.geometry.computeVertexNormals();
    for (const side of [-1, 1]) {
        box(root, [1.5, 0.08, 1.35], [0, side * 0.68 - 0.52, -0.25], dark);
        for (const z of [-0.9, 0.42])
            strut(
                root,
                [side * 0.73, -1.2, z],
                [side * 0.73, 0.2, z],
                0.045,
                metal,
            );
        box(root, [0.035, 1.12, 1.02], [side * 0.76, -0.5, -0.25], radiator);
        for (let i = 0; i < 14; i++)
            strut(
                root,
                [side * 0.789, -1.03 + i * 0.08, -0.77],
                [side * 0.789, -1.03 + i * 0.08, 0.27],
                0.008,
                metal,
            );
        for (const y of [-1.06, 0.05])
            for (const z of [-0.74, 0.24])
                box(root, [0.06, 0.065, 0.06], [side * 0.79, y, z], gold);
    }
    const gimbal = new T.Group();
    gimbal.position.set(0, 0.45, 0.05);
    root.add(gimbal);
    const pedestal = tube(gimbal, 0.24, 0.46, [0, -0.1, -0.08], metal, 64);
    pedestal.rotation.z = 0.15;
    ring(gimbal, 0.22, 0.03, [0, 0.14, 0.18], gold);
    const reflector = dish(gimbal, 1.55, [0, 0.55, 0.18]);
    reflector.rotation.x = -0.2;
    // Rear ribs follow the dish curvature and converge on its support bearing.
    for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI) / 12;
        const curve = new T.CatmullRomCurve3(
            Array.from({ length: 12 }, (_, n) => {
                const r = (1.5 * n) / 11;
                return new T.Vector3(
                    Math.cos(a) * r,
                    Math.sin(a) * r,
                    (r * r) / (1.55 * 2.9) - 0.065,
                );
            }),
        );
        mesh(reflector, new T.TubeGeometry(curve, 32, 0.017, 8, false), metal);
    }
    for (const radius of [0.45, 1.0, 1.5])
        ring(
            reflector,
            radius,
            0.014,
            [0, 0, (radius * radius) / (1.55 * 2.9) - 0.075],
            dark,
        );
    for (let i = 0; i < 48; i++) {
        const a = (i * Math.PI) / 24;
        const clip = box(
            reflector,
            [0.025, 0.055, 0.07],
            [Math.cos(a) * 1.55, Math.sin(a) * 1.55, 1.55 / 2.9],
            gold,
        );
        clip.rotation.z = a - Math.PI / 2;
    }
    truss(root, [-4.25, -0.75, -0.4], [4.25, -0.75, -0.4], 0.11);
    for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
            const panel = wing(
                root,
                side * (1.65 + i * 1.14),
                -0.75,
                -0.43,
                0.76,
            );
            panel.rotation.x = 0.09;
            box(
                root,
                [0.1, 0.21, 0.16],
                [side * (1.1 + i * 1.14), -0.75, -0.41],
                gold,
            );
        }
        for (const z of [-0.65, 0.18]) {
            const thruster = new T.Group();
            thruster.position.set(side * 0.53, -1.34, z);
            thruster.rotation.z = side * 0.16;
            root.add(thruster);
            mesh(
                thruster,
                new T.CylinderGeometry(0.09, 0.18, 0.26, 48, 1, true),
                dark,
            );
            tube(thruster, 0.105, 0.14, [0, 0.17, 0], gold);
            for (let i = 0; i < 6; i++) {
                const a = (i * Math.PI) / 3;
                strut(
                    thruster,
                    [Math.cos(a) * 0.1, 0.06, Math.sin(a) * 0.1],
                    [Math.cos(a) * 0.17, -0.13, Math.sin(a) * 0.17],
                    0.009,
                    metal,
                );
            }
        }
        const cable = new T.CatmullRomCurve3([
            new T.Vector3(side * 0.4, -1.1, 0.45),
            new T.Vector3(side * 0.72, -0.2, 0.48),
            new T.Vector3(side * 0.5, 0.4, 0.2),
            new T.Vector3(side * 0.2, 0.5, 0.12),
        ]);
        mesh(root, new T.TubeGeometry(cable, 48, 0.028, 8, false), dark);
        const patch = dish(root, 0.3, [side * 0.73, -0.6, 0.5]);
        patch.rotation.y = side * 0.3;
    }
    strut(root, [0.5, 0.2, -0.7], [0.5, 2.35, -0.7], 0.018, metal);
    box(root, [0.22, 0.12, 0.08], [0.5, 1.75, -0.7], gold);
    mesh(root, new T.SphereGeometry(0.035, 20, 12), amber, [0.5, 2.35, -0.7]);
    for (const x of [-0.4, 0.4])
        box(root, [0.05, 0.05, 0.03], [x, -0.1, 0.46], light);
    root.rotation.set(0.12, -0.58, 0.16);
    root.scale.setScalar(0.81);
    return gimbal;
}
