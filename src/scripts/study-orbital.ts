import * as T from "three";
import { finishSurface } from "./study-surfaces";
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

/** A curved section of hull; its glazing follows the pressure vessel. */
function hullPatch(
    radius: number,
    tube: number,
    start: number,
    arc: number,
    around: number,
    span: number,
) {
    const positions: number[] = [],
        uv: number[] = [],
        indices: number[] = [];
    const U = 20,
        V = 12;
    for (let j = 0; j <= V; j++)
        for (let i = 0; i <= U; i++) {
            const u = start + (arc * i) / U,
                v = around + (span * j) / V;
            positions.push(
                (radius + tube * Math.cos(v)) * Math.cos(u),
                (radius + tube * Math.cos(v)) * Math.sin(u),
                tube * Math.sin(v),
            );
            uv.push(i / U, j / V);
        }
    for (let j = 0; j < V; j++)
        for (let i = 0; i < U; i++) {
            const a = j * (U + 1) + i,
                b = a + U + 1;
            indices.push(a, a + 1, b, b, a + 1, b + 1);
        }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
}

export function makeOrbitalWorkshop(k: OrbitalKit) {
    const {
        root,
        ivory,
        metal,
        gold,
        dark,
        amber,
        light,
        foil,
        mesh,
        box,
        tube,
        ring,
        strut,
        bolts,
        wing,
        dish,
        truss,
    } = k;
    const paint = ivory.clone();
    paint.color.set(0x9e9e90);
    paint.map = null;
    paint.roughness = 0.38;
    finishSurface(paint, "paint");
    finishSurface(metal);
    paint.metalness = 0.35;
    const thermal = ivory.clone();
    thermal.map = null;
    thermal.color.set(0x7a847c);
    thermal.metalness = 0.65;
    thermal.roughness = 0.45;
    const rubber = dark.clone();
    rubber.metalness = 0.15;
    rubber.roughness = 0.68;
    k.materials.push(paint, thermal, rubber);
    const cabin = document.createElement("canvas");
    cabin.width = 512;
    cabin.height = 256;
    const ctx = cabin.getContext("2d")!;
    const glow = ctx.createLinearGradient(0, 0, 0, 256);
    glow.addColorStop(0, "#2c211c");
    glow.addColorStop(0.45, "#b97e38");
    glow.addColorStop(0.75, "#ebba6b");
    glow.addColorStop(1, "#443322");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 6; i++) {
        const x = i * 85;
        ctx.fillStyle = "#2b2723";
        ctx.fillRect(x + 8, 178, 55, 13);
        ctx.fillRect(x + 22, 190, 8, 34);
        ctx.fillRect(x + 53, 190, 8, 34);
        ctx.fillStyle = "#cfb082";
        ctx.fillRect(x + 12, 9, 45, 4);
        ctx.fillStyle = "#43392b";
        ctx.fillRect(x + 10, 66, 32, 60);
        ctx.fillStyle = "#9d733d";
        ctx.fillRect(x + 13, 70, 26, 49);
    }
    for (const x of [104, 288, 420]) {
        ctx.fillStyle = "#423b30";
        ctx.beginPath();
        ctx.arc(x, 143, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x - 5, 150, 11, 27);
        ctx.fillRect(x - 5, 175, 3, 16);
        ctx.fillRect(x + 3, 175, 3, 16);
    }
    const cabinMap = new T.CanvasTexture(cabin);
    cabinMap.colorSpace = T.SRGBColorSpace;
    k.textures.push(cabinMap);
    const windows = new T.MeshStandardMaterial({
        map: cabinMap,
        color: 0xc8b891,
        metalness: 0.15,
        roughness: 0.25,
        emissive: 0xffb365,
        emissiveMap: cabinMap,
        emissiveIntensity: 1.25,
    });
    k.materials.push(windows);
    const mount = new T.Group();
    mount.rotation.x = -Math.PI / 2;
    mount.position.set(0.45, 0, -1.6);
    root.add(mount);
    const habitat = new T.Group();
    mount.add(habitat);
    const R = 2.1,
        r = 0.4,
        N = 16;
    for (let n = 0; n < N; n++) {
        const a = (n * Math.PI * 2) / N,
            arc = (Math.PI * 2) / N;
        const segment = mesh(
            habitat,
            new T.TorusGeometry(R, r, 48, 28, arc - 0.018),
            paint,
            [0, 0, -0.35],
        );
        segment.rotation.z = a + 0.009;
        for (const u of [a]) {
            const collar = ring(
                habitat,
                r + 0.015,
                0.018,
                [Math.cos(u) * R, Math.sin(u) * R, -0.35],
                metal,
            );
            collar.quaternion.setFromUnitVectors(
                new T.Vector3(0, 0, 1),
                new T.Vector3(-Math.sin(u), Math.cos(u), 0),
            );
        }
        mesh(
            habitat,
            hullPatch(R, r + 0.014, a + 0.045, arc - 0.09, -0.32, 0.85),
            dark,
            [0, 0, -0.35],
        );
        mesh(
            habitat,
            hullPatch(R, r + 0.019, a + 0.058, arc - 0.116, -0.22, 0.66),
            windows,
            [0, 0, -0.35],
        );
        mesh(
            habitat,
            hullPatch(R, r + 0.014, a + 0.06, arc - 0.12, 1.15, 0.56),
            thermal,
            [0, 0, -0.35],
        );
        for (const f of [0.33, 0.66])
            mesh(
                habitat,
                hullPatch(
                    R,
                    r + 0.023,
                    a + 0.045 + (arc - 0.09) * f,
                    0.009,
                    -0.32,
                    0.85,
                ),
                metal,
                [0, 0, -0.35],
            );
        const u = a + arc * 0.5;
        const module = new T.Group();
        module.position.set(
            Math.cos(u) * (R + 0.38),
            Math.sin(u) * (R + 0.38),
            -0.35,
        );
        module.rotation.z = u - Math.PI / 2;
        habitat.add(module);
        box(module, [0.22, 0.11, 0.28], [0, 0, -0.01], dark);
        box(module, [0.16, 0.035, 0.18], [0, 0.075, -0.01], thermal);
        for (const x of [-0.075, 0.075])
            box(module, [0.014, 0.03, 0.15], [x, 0.102, -0.01], metal);
        if (n % 2 === 0) {
            box(module, [0.08, 0.018, 0.035], [0, 0.11, 0.08], amber);
            truss(
                habitat,
                [Math.cos(u) * 0.66, Math.sin(u) * 0.66, -0.4],
                [Math.cos(u) * (R - r), Math.sin(u) * (R - r), -0.4],
                0.085,
            );
        }
    }
    for (const rad of [R - r - 0.07, R + r + 0.06])
        ring(habitat, rad, 0.014, [0, 0, -0.24], metal);
    for (let i = 0; i < 40; i++) {
        const a = (i * Math.PI) / 20;
        strut(
            habitat,
            [Math.cos(a) * (R + r), Math.sin(a) * (R + r), -0.35],
            [Math.cos(a) * (R + r + 0.07), Math.sin(a) * (R + r + 0.07), -0.23],
            0.01,
            metal,
        );
    }
    // Multi-stage docking spine, with recessed mechanisms and connected service modules.
    const beforeSpine = new Set(root.children);
    const profile = [
        [0.42, -1.7],
        [0.52, -1.62],
        [0.63, -1.35],
        [0.63, 1.05],
        [0.61, 1.26],
        [0.51, 1.42],
        [0.51, 1.57],
    ].map((p) => new T.Vector2(...(p as [number, number])));
    const spine = mesh(
        root,
        new T.LatheGeometry(profile, 128),
        paint,
        [0, 0, 0.15],
    );
    spine.rotation.x = Math.PI / 2;
    for (const z of [-1.45, -0.94, -0.35, 0.25, 0.85, 1.35]) {
        ring(root, 0.645, 0.034, [0, 0, z], metal);
        ring(root, 0.65, 0.013, [0, 0, z + 0.065], rubber);
        for (let i = 0; i < 16; i++) {
            const a = (i * Math.PI) / 8;
            const latch = box(
                root,
                [0.08, 0.13, 0.1],
                [Math.cos(a) * 0.65, Math.sin(a) * 0.65, z],
                dark,
            );
            latch.rotation.z = a - Math.PI / 2;
        }
    }
    for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5;
        strut(
            root,
            [Math.cos(a) * 0.64, Math.sin(a) * 0.64, -1.38],
            [Math.cos(a) * 0.64, Math.sin(a) * 0.64, 1.27],
            0.018,
            metal,
        );
        const panel = box(
            root,
            [0.23, 0.045, 0.55],
            [Math.cos(a) * 0.65, Math.sin(a) * 0.65, 0.55],
            thermal,
        );
        panel.rotation.z = a - Math.PI / 2;
        const window = box(
            root,
            [0.18, 0.02, 0.19],
            [Math.cos(a) * 0.68, Math.sin(a) * 0.68, -0.64],
            windows,
        );
        window.rotation.z = a - Math.PI / 2;
    }
    const dock = new T.Group();
    dock.position.z = 1.57;
    root.add(dock);
    const end = tube(dock, 0.53, 0.16, [0, 0, 0], dark, 96);
    end.rotation.x = Math.PI / 2;
    for (const [rad, z, mat] of [
        [0.53, 0.02, metal],
        [0.47, 0.08, gold],
        [0.415, 0.1, dark],
        [0.35, 0.115, metal],
    ] as const)
        ring(dock, rad, 0.022, [0, 0, z], mat);
    const hatch = tube(dock, 0.347, 0.035, [0, 0, 0.1], thermal, 96);
    hatch.rotation.x = Math.PI / 2;
    for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const locking = box(
            dock,
            [0.09, 0.16, 0.04],
            [Math.cos(a) * 0.29, Math.sin(a) * 0.29, 0.14],
            dark,
        );
        locking.rotation.z = a;
        box(
            dock,
            [0.035, 0.035, 0.02],
            [Math.cos(a) * 0.49, Math.sin(a) * 0.49, 0.12],
            i % 2 ? amber : light,
        );
    }
    bolts(dock, 0.56, 0.07, 16);
    box(dock, [0.4, 0.025, 0.018], [0, 0, 0.145], metal);
    box(dock, [0.025, 0.4, 0.018], [0, 0, 0.145], metal);
    const spineAssembly = new T.Group();
    for (const part of [...root.children])
        if (!beforeSpine.has(part)) spineAssembly.add(part);
    spineAssembly.scale.set(1.17, 1.17, 1.08);
    spineAssembly.position.z = 0.25;
    root.add(spineAssembly);
    // Asymmetric thermal radiators and folded blankets make the machine readable.
    for (const side of [-1, 1]) {
        truss(root, [side * 0.5, 0, -1.12], [side * 4.35, 0, -1.12], 0.17);
        for (let i = 0; i < 2; i++) {
            const array = wing(root, side * (3.3 + i * 1.36), 0, -1.15, 0.9);
            array.rotation.x = -Math.PI / 2 + 0.12;
            box(
                root,
                [0.12, 0.28, 0.18],
                [side * (2.62 + i * 1.36), 0, -1.12],
                gold,
            );
        }
        box(root, [0.48, 0.62, 0.72], [side * 0.81, -0.3, -1.06], foil);
        const radiator = new T.Group();
        radiator.position.set(side * 0.98, -1.08, -1.25);
        radiator.rotation.z = -side * 0.14;
        root.add(radiator);
        box(radiator, [1.15, 1.15, 0.055], [0, 0, 0], thermal);
        for (let i = 0; i < 22; i++)
            box(
                radiator,
                [0.018, 1.1, 0.04],
                [-0.52 + i * 0.05, 0, 0.044],
                metal,
            );
        for (const y of [-0.58, 0.58])
            strut(radiator, [-0.6, y, 0.045], [0.6, y, 0.045], 0.024, gold);
    }
    // An instrument tower and external plumbing, supported by the spine.
    truss(root, [0, 0.55, -0.8], [0, 2.45, -0.8], 0.13);
    for (const y of [1.05, 1.55]) {
        box(root, [0.48, 0.34, 0.52], [0, y, -0.8], paint);
        box(root, [0.38, 0.24, 0.02], [0, y, -0.525], dark);
        for (let i = 0; i < 6; i++)
            box(
                root,
                [0.32, 0.012, 0.025],
                [0, y - 0.09 + i * 0.036, -0.51],
                metal,
            );
        for (const x of [-0.17, 0.17])
            box(root, [0.035, 0.035, 0.02], [x, y + 0.12, -0.51], amber);
    }
    const radome = mesh(
        root,
        new T.SphereGeometry(0.32, 48, 32),
        paint,
        [0, 2.35, -0.8],
    );
    for (const rotation of [0, Math.PI / 3, (Math.PI * 2) / 3]) {
        const seam = ring(root, 0.322, 0.006, [0, 2.35, -0.8], metal);
        seam.rotation.y = rotation;
    }
    radome.scale.y = 1.05;
    for (const side of [-1, 1]) {
        strut(
            root,
            [side * 0.24, 0.62, -0.5],
            [side * 0.24, 2.25, -0.5],
            0.025,
            gold,
        );
        const antenna = dish(root, 0.3, [side * 0.86, -0.65, 0.5]);
        antenna.rotation.y = side * 0.4;
        strut(
            root,
            [side * 0.24, 2.15, -0.5],
            [side * 0.24, 2.85, -0.5],
            0.012,
            metal,
        );
        mesh(root, new T.SphereGeometry(0.028, 16, 12), amber, [
            side * 0.24,
            2.85,
            -0.5,
        ]);
    }
    root.rotation.set(0.08, -0.48, 0.035);
    root.scale.setScalar(1.08);
    return habitat;
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
