import * as T from "three";
import {
    finishSurface,
    smoothMachinedPart,
    makeOpticalEnvironment,
    makeMachiningRelief,
} from "./study-surfaces";

export interface MachineryKit {
    root: T.Group;
    ivory: T.MeshStandardMaterial;
    metal: T.MeshStandardMaterial;
    gold: T.MeshStandardMaterial;
    dark: T.MeshStandardMaterial;
    amber: T.MeshStandardMaterial;
    light: T.MeshStandardMaterial;
    materials: T.Material[];
    textures: T.Texture[];
    mesh: (
        parent: T.Object3D,
        geometry: T.BufferGeometry,
        material: T.Material,
        position?: number[],
    ) => T.Mesh;
    box: (
        parent: T.Object3D,
        size: [number, number, number],
        position: number[],
        material: T.Material,
    ) => T.Mesh;
    tube: (
        parent: T.Object3D,
        radius: number,
        length: number,
        position: number[],
        material: T.Material,
        sides?: number,
    ) => T.Mesh;
    ring: (
        parent: T.Object3D,
        radius: number,
        thickness: number,
        position: number[],
        material: T.Material,
    ) => T.Mesh;
    strut: (
        parent: T.Object3D,
        from: number[],
        to: number[],
        radius: number,
        material?: T.Material,
    ) => T.Mesh;
    bolts: (
        parent: T.Object3D,
        radius: number,
        z: number,
        count?: number,
    ) => void;
}

/** A machined perception arm: real plate cutouts, bearings, optics and harnesses. */
export function makePerceptionArm(k: MachineryKit) {
    const {
        root,
        ivory,
        metal,
        gold,
        dark,
        amber,
        mesh,
        box,
        tube,
        ring,
        strut,
        bolts,
    } = k;
    const paint = ivory.clone();
    paint.color.set(0xaaa99a);
    paint.metalness = 0.28;
    paint.roughness = 0.32;
    const titanium = metal.clone();
    titanium.color.set(0xa1a5a0);
    titanium.roughness = 0.23;
    const rubber = dark.clone();
    rubber.color.set(0x0c1117);
    rubber.metalness = 0.05;
    rubber.roughness = 0.65;
    const bronze = gold.clone();
    bronze.color.set(0xbb7d3f);
    bronze.roughness = 0.22;
    const optic = new T.MeshPhysicalMaterial({
        color: 0x5b7d89,
        metalness: 0.7,
        roughness: 0.055,
        clearcoat: 1,
        clearcoatRoughness: 0.025,
    });
    finishSurface(paint, "paint");
    finishSurface(titanium);
    finishSurface(bronze);
    optic.iridescence = 0.35;
    optic.iridescenceIOR = 1.35;
    optic.iridescenceThicknessRange = [130, 390];
    const opticsEnvironment = makeOpticalEnvironment();
    k.textures.push(opticsEnvironment);
    optic.envMap = opticsEnvironment;
    optic.envMapIntensity = 1.35;
    optic.color.set(0x395966);
    optic.metalness = 0.78;
    optic.roughness = 0.045;
    const machining = makeMachiningRelief();
    k.textures.push(machining);
    const brushed = titanium.clone();
    brushed.bumpMap = machining;
    brushed.bumpScale = 0.005;
    brushed.roughness = 0.33;
    k.materials.push(brushed);
    k.materials.push(paint, titanium, rubber, bronze, optic);
    const cable = (
        parent: T.Object3D,
        points: number[][],
        radius = 0.035,
        material = rubber,
    ) => {
        const curve = new T.CatmullRomCurve3(
            points.map((p) => new T.Vector3().fromArray(p)),
        );
        mesh(
            parent,
            new T.TubeGeometry(curve, 72, radius, 12, false),
            material,
        );
        return curve;
    };
    const faceCylinder = (
        parent: T.Object3D,
        radius: number,
        length: number,
        position: number[],
        material: T.Material,
        sides = 96,
    ) => {
        const part = tube(parent, radius, length, position, material, sides);
        part.rotation.x = Math.PI / 2;
        return part;
    };
    const roundSlot = (width: number, length: number, center: number) => {
        const path = new T.Path();
        const radius = width / 2,
            span = Math.max(0, (length - width) / 2);
        path.absarc(0, center + span, radius, 0, Math.PI, false);
        path.absarc(0, center - span, radius, Math.PI, Math.PI * 2, false);
        path.closePath();
        return path;
    };
    const link = (a: number[], b: number[], width: number) => {
        const start = new T.Vector3().fromArray(a),
            end = new T.Vector3().fromArray(b),
            length = start.distanceTo(end);
        const frame = new T.Group();
        frame.position.copy(start.clone().lerp(end, 0.5));
        frame.quaternion.setFromUnitVectors(
            new T.Vector3(0, 1, 0),
            end.sub(start).normalize(),
        );
        root.add(frame);
        const outline = new T.Shape();
        const r = width / 2;
        outline.absarc(0, length / 2 - 0.14, r, 0, Math.PI, false);
        outline.absarc(0, -length / 2 + 0.14, r, Math.PI, Math.PI * 2, false);
        outline.closePath();
        outline.holes.push(roundSlot(width * 0.44, length * 0.55, 0));
        const plate = smoothMachinedPart(
            new T.ExtrudeGeometry(outline, {
                depth: 0.09,
                bevelEnabled: true,
                bevelSegments: 5,
                bevelSize: 0.025,
                bevelThickness: 0.025,
                curveSegments: 32,
                steps: 1,
            }),
        );
        for (const z of [-0.26, 0.17]) {
            mesh(frame, plate, paint, [0, 0, z]);
            for (const side of [-1, 1])
                for (const y of [-length * 0.28, 0, length * 0.28]) {
                    faceCylinder(
                        frame,
                        0.029,
                        0.018,
                        [side * width * 0.38, y, z + 0.116],
                        titanium,
                        6,
                    );
                }
        }
        strut(
            frame,
            [-width * 0.33, -length / 2 + 0.12, 0],
            [-width * 0.33, length / 2 - 0.12, 0],
            0.075,
            rubber,
        );
        strut(
            frame,
            [width * 0.32, -length / 2 + 0.1, 0],
            [width * 0.32, length * 0.03, 0],
            0.075,
            dark,
        );
        strut(
            frame,
            [width * 0.32, length * 0.03, 0],
            [width * 0.32, length / 2 - 0.13, 0],
            0.04,
            titanium,
        );
    };
    // The broad deck gives the instrument mass and a legible, human scale.
    tube(root, 3.02, 0.27, [0, -1.96, 0], dark, 160);
    tube(root, 3, 0.045, [0, -1.805, 0], titanium, 160);
    tube(root, 2.87, 0.035, [0, -1.77, 0], dark, 160);
    for (const radius of [1.45, 2.45, 2.71, 2.94]) {
        const track = ring(
            root,
            radius,
            radius === 2.94 ? 0.016 : 0.009,
            [0, -1.744, 0],
            radius === 2.94 ? amber : bronze,
        );
        track.rotation.x = Math.PI / 2;
    }
    for (let i = 0; i < 64; i++) {
        const a = (i * Math.PI) / 32,
            x = Math.cos(a),
            z = Math.sin(a);
        const tick = box(
            root,
            [0.013, 0.009, i % 4 ? 0.055 : 0.13],
            [x * 2.77, -1.741, z * 2.77],
            i % 4 ? titanium : paint,
        );
        tick.rotation.y = Math.PI / 2 - a;
        if (i % 4 === 0) {
            tube(root, 0.027, 0.013, [x * 2.94, -1.771, z * 2.94], dark, 6);
            const latch = box(
                root,
                [0.17, 0.18, 0.06],
                [x * 3.02, -1.92, z * 3.02],
                titanium,
            );
            latch.rotation.y = Math.PI / 2 - a;
        }
    }
    const base = [0.95, -1.62, -0.08];
    tube(root, 0.87, 0.07, [0.95, -1.71, -0.08], dark, 128);
    tube(root, 0.87, 0.11, base, titanium, 128);
    tube(root, 0.76, 0.13, [0.95, -1.5, -0.08], dark, 128);
    tube(root, 0.64, 0.13, [0.95, -1.37, -0.08], paint, 128);
    tube(root, 0.52, 0.18, [0.95, -1.24, -0.08], dark, 96);
    for (let i = 0; i < 20; i++) {
        const a = (i * Math.PI) / 10;
        tube(
            root,
            0.028,
            0.035,
            [0.95 + Math.cos(a) * 0.79, -1.55, -0.08 + Math.sin(a) * 0.79],
            bronze,
            6,
        );
    }
    const joints = [
        [0.95, -1.1, 0],
        [1.63, 0.22, 0],
        [0.52, 1.38, 0.12],
    ];
    link(joints[0], joints[1], 0.74);
    link(joints[1], joints[2], 0.61);
    for (const [i, point] of joints.entries()) {
        const joint = new T.Group();
        joint.position.fromArray(point);
        root.add(joint);
        const radius = i === 0 ? 0.41 : i === 1 ? 0.33 : 0.27;
        faceCylinder(joint, radius, 0.63, [0, 0, 0], dark);
        faceCylinder(joint, radius * 0.93, 0.08, [0, 0, 0.34], titanium);
        faceCylinder(joint, radius * 0.72, 0.045, [0, 0, 0.405], bronze);
        faceCylinder(joint, radius * 0.57, 0.055, [0, 0, 0.44], brushed);
        ring(joint, radius * 0.78, 0.018, [0, 0, 0.445], dark);
        bolts(joint, radius * 0.82, 0.395, 10);
        for (let n = 0; n < 24; n++) {
            const a = (n * Math.PI) / 12;
            const notch = box(
                joint,
                [0.013, 0.06, 0.1],
                [Math.cos(a) * radius, Math.sin(a) * radius, -0.14],
                titanium,
            );
            notch.rotation.z = a - Math.PI / 2;
        }
    }
    const harness = [
        [1.27, -1.3, -0.25],
        [2.02, -0.35, -0.22],
        [2.0, 0.5, -0.24],
        [1.02, 1.57, -0.2],
        [0.08, 1.67, -0.2],
    ];
    for (const offset of [-0.08, 0.08]) {
        const path = cable(
            root,
            harness.map((p) => [p[0], p[1] + offset, p[2]]),
            0.052,
        );
        for (let i = 0; i < 46; i++) {
            const t = i / 45,
                point = path.getPoint(t),
                tangent = path.getTangent(t);
            const corrugation = ring(
                root,
                0.056,
                0.01,
                point.toArray(),
                rubber,
            );
            corrugation.quaternion.setFromUnitVectors(
                new T.Vector3(0, 0, 1),
                tangent,
            );
        }
    }
    cable(
        root,
        [
            [1.15, -1.17, 0.32],
            [1.65, -0.25, 0.41],
            [1.73, 0.32, 0.4],
            [0.92, 1.2, 0.43],
            [0.35, 1.32, 0.4],
        ],
        0.025,
        bronze,
    );
    const head = new T.Group();
    head.position.set(-0.05, 1.48, 0.17);
    root.add(head);
    faceCylinder(head, 0.24, 0.65, [0.46, -0.05, -0.28], titanium);
    const enclosure = new T.Shape();
    enclosure.moveTo(-1.19, 0.09);
    enclosure.lineTo(-1.19, 0.65);
    enclosure.quadraticCurveTo(-1.19, 0.85, -0.98, 0.89);
    enclosure.lineTo(0.93, 0.89);
    enclosure.quadraticCurveTo(1.19, 0.86, 1.19, 0.65);
    enclosure.lineTo(1.19, 0.09);
    enclosure.quadraticCurveTo(1.16, -0.08, 0.95, -0.08);
    enclosure.lineTo(0.25, -0.08);
    enclosure.lineTo(0.15, -0.02);
    enclosure.lineTo(-0.15, -0.02);
    enclosure.lineTo(-0.25, -0.08);
    enclosure.lineTo(-0.96, -0.08);
    enclosure.quadraticCurveTo(-1.19, -0.06, -1.19, 0.09);
    const shell = new T.ExtrudeGeometry(enclosure, {
        depth: 0.72,
        bevelEnabled: true,
        bevelSize: 0.045,
        bevelThickness: 0.045,
        bevelSegments: 5,
        curveSegments: 32,
    });
    mesh(head, smoothMachinedPart(shell), paint, [0, 0, -0.36]);
    box(head, [2.08, 0.81, 0.055], [0, 0.38, 0.44], dark);
    box(head, [1.8, 0.68, 0.22], [0, 0.38, -0.49], dark);
    for (const side of [-1, 1]) {
        box(head, [0.085, 0.75, 0.72], [side * 1.13, 0.38, 0], titanium);
        for (let n = 0; n < 9; n++)
            box(
                head,
                [0.038, 0.63, 0.055],
                [side * 0.99, 0.38, -0.55 + n * 0.045],
                dark,
            );
        for (const y of [0.04, 0.72])
            for (const x of [side * 0.94, side * 0.18])
                faceCylinder(head, 0.025, 0.018, [x, y, 0.49], titanium, 6);
    }
    for (const x of [-0.55, 0.55]) {
        const barrelProfile = [
            [0.37, 0],
            [0.42, 0.025],
            [0.42, 0.13],
            [0.39, 0.15],
            [0.39, 0.31],
            [0.43, 0.33],
            [0.43, 0.37],
            [0.37, 0.39],
        ].map((p) => new T.Vector2(...(p as [number, number])));
        const barrel = mesh(
            head,
            new T.LatheGeometry(barrelProfile, 96),
            dark,
            [x, 0.38, 0.48],
        );
        barrel.rotation.x = Math.PI / 2;
        // Lathe's local +Y becomes the forward optical axis.
        barrel.rotation.x = -Math.PI / 2;
        for (const [r, z, mat] of [
            [0.419, 0.51, titanium],
            [0.395, 0.68, bronze],
            [0.427, 0.825, titanium],
            [0.368, 0.87, bronze],
        ] as const)
            ring(head, r, 0.013, [x, 0.38, z], mat);
        faceCylinder(head, 0.35, 0.025, [x, 0.38, 0.854], rubber);
        // The barrel permanently hides the rear hemisphere. Spend those
        // segments on the curved optical face that the visitor can inspect.
        const lens = mesh(
            head,
            new T.SphereGeometry(0.34, 64, 40, 0, Math.PI),
            optic,
            [x, 0.38, 0.887],
        );
        lens.scale.z = 0.16;
        for (const r of [0.29, 0.315, 0.344])
            ring(head, r, 0.006, [x, 0.38, 0.92], r === 0.315 ? bronze : dark);
        for (let i = 0; i < 48; i++) {
            const a = (i * Math.PI) / 24;
            const groove = box(
                head,
                [0.012, 0.025, 0.11],
                [x + Math.cos(a) * 0.421, 0.38 + Math.sin(a) * 0.421, 0.77],
                dark,
            );
            groove.rotation.z = a - Math.PI / 2;
        }
        for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI) / 4;
            faceCylinder(
                head,
                0.018,
                0.018,
                [x + Math.cos(a) * 0.393, 0.38 + Math.sin(a) * 0.393, 0.866],
                titanium,
                6,
            );
        }
    }
    box(head, [0.78, 0.22, 0.42], [0, 1.0, -0.05], dark);
    box(head, [0.56, 0.05, 0.02], [0, 1.0, 0.172], amber);
    for (const side of [-1, 1]) {
        box(head, [0.13, 0.22, 0.44], [side * 0.43, 1.0, -0.05], paint);
        cable(
            head,
            [
                [side * 0.65, 0.83, -0.12],
                [side * 0.72, 1.12, -0.15],
                [side * 0.25, 1.13, -0.3],
                [side * 0.1, 0.8, -0.5],
            ],
            0.027,
            bronze,
        );
    }
    for (let i = 0; i < 8; i++) {
        const b = ring(
            head,
            0.23,
            0.035,
            [0.1, -0.2 - i * 0.037, -0.14],
            rubber,
        );
        b.rotation.x = Math.PI / 2;
    }
    tube(head, 0.26, 0.06, [0.1, -0.52, -0.14], titanium);
    // Calibration objects have physical clamps and holders, not floating symbols.
    const checkerCanvas = document.createElement("canvas");
    checkerCanvas.width = checkerCanvas.height = 256;
    const context = checkerCanvas.getContext("2d")!;
    for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
            context.fillStyle = (x + y) % 2 ? "#d8d4bf" : "#171c21";
            context.fillRect(x * 32, y * 32, 32, 32);
        }
    const checkerMap = new T.CanvasTexture(checkerCanvas);
    checkerMap.colorSpace = T.SRGBColorSpace;
    k.textures.push(checkerMap);
    const targetMaterial = new T.MeshStandardMaterial({
        map: checkerMap,
        roughness: 0.8,
    });
    k.materials.push(targetMaterial);
    const target = new T.Group();
    target.position.set(-1.65, -1.37, 0.45);
    target.rotation.x = -0.13;
    root.add(target);
    box(target, [0.62, 0.62, 0.045], [0, 0.03, 0], titanium);
    box(target, [0.55, 0.55, 0.006], [0, 0.03, 0.026], targetMaterial);
    strut(root, [-1.65, -1.73, 0.5], [-1.65, -1.34, 0.5], 0.06, titanium);
    box(root, [0.65, 0.08, 0.46], [-1.65, -1.7, 0.5], dark);
    for (const [x, z] of [
        [-0.65, 1.45],
        [0.3, 1.65],
        [1.35, 1.4],
    ]) {
        tube(root, 0.24, 0.08, [x, -1.69, z], titanium, 48);
        for (let i = 0; i < 4; i++) {
            const a = (i * Math.PI) / 2;
            box(
                root,
                [0.075, 0.08, 0.075],
                [x + Math.cos(a) * 0.2, -1.61, z + Math.sin(a) * 0.2],
                dark,
            );
        }
    }
    mesh(
        root,
        new T.SphereGeometry(0.22, 64, 40),
        titanium,
        [-0.65, -1.43, 1.45],
    );
    const rockGeometry = new T.IcosahedronGeometry(0.27, 5);
    const p = rockGeometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
            y = p.getY(i),
            z = p.getZ(i);
        const scale = 1 + 0.16 * Math.sin(x * 23 + y * 17) * Math.cos(z * 27);
        p.setXYZ(i, x * scale, y * scale, z * scale);
    }

    const stone = finishSurface(
        new T.MeshStandardMaterial({ color: 0x54534a, roughness: 0.95 }),
        "stone",
    );
    k.materials.push(stone);
    mesh(root, smoothMachinedPart(rockGeometry), stone, [0.3, -1.4, 1.65]);
    box(root, [0.32, 0.32, 0.32], [1.35, -1.45, 1.4], paint);
    for (const [x, y] of [
        [1.28, -1.38],
        [1.42, -1.38],
        [1.28, -1.52],
        [1.42, -1.52],
    ])
        faceCylinder(root, 0.028, 0.006, [x, y, 1.563], dark, 24);
    for (const side of [-1, 1]) {
        box(head, [0.018, 0.36, 0.41], [side * 1.236, 0.38, -0.02], dark);
        box(head, [0.025, 0.28, 0.33], [side * 1.248, 0.38, -0.02], titanium);
        for (const y of [0.22, 0.54])
            for (const z of [-0.17, 0.13]) {
                const screw = tube(
                    head,
                    0.018,
                    0.025,
                    [side * 1.264, y, z],
                    dark,
                    6,
                );
                screw.rotation.z = Math.PI / 2;
            }
    }
    const plaque = document.createElement("canvas");
    plaque.width = 512;
    plaque.height = 96;
    const label = plaque.getContext("2d")!;
    label.fillStyle = "#252b2a";
    label.fillRect(0, 0, 512, 96);
    label.fillStyle = "#d7d0b4";
    label.font = "28px monospace";
    label.fillText("STEREO / OPTICS — 03", 20, 40);
    label.font = "14px monospace";
    label.fillStyle = "#8d9b93";
    label.fillText("PERCEPTION SYSTEM · CALIBRATED", 20, 70);
    const marking = new T.CanvasTexture(plaque);
    marking.colorSpace = T.SRGBColorSpace;
    k.textures.push(marking);
    const decal = new T.MeshStandardMaterial({
        map: marking,
        roughness: 0.6,
        metalness: 0.2,
    });
    k.materials.push(decal);
    box(head, [0.8, 0.15, 0.012], [0, 0.72, 0.49], decal);
    head.scale.setScalar(1.08);
    root.rotation.set(0, -0.52, 0);
    root.scale.setScalar(1.18);
    root.position.x = 0.2;
    return head;
}
