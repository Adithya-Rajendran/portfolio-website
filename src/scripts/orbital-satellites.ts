import type * as Three from "three";

/** Original observatory and relay spacecraft, enlarged for orbital legibility. */
export function addSatellites(T: typeof Three, earth: Three.Group) {
    const assembly = new T.Group();
    assembly.name = "Earth orbital observatory and communications relay";
    const metal = new T.MeshStandardMaterial({
        color: 0xd4dee0,
        metalness: 0.82,
        roughness: 0.26,
    });
    const foil = new T.MeshStandardMaterial({
        color: 0xc99744,
        metalness: 0.82,
        roughness: 0.4,
    });
    const white = new T.MeshStandardMaterial({
        color: 0xe7e8dc,
        metalness: 0.18,
        roughness: 0.62,
    });
    const graphite = new T.MeshStandardMaterial({
        color: 0x131c24,
        metalness: 0.55,
        roughness: 0.4,
    });
    const lens = new T.MeshStandardMaterial({
        color: 0x124c63,
        metalness: 0.85,
        roughness: 0.12,
    });
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#90a7b9";
    ctx.fillRect(0, 0, 256, 512);
    for (let row = 0; row < 16; row++)
        for (let col = 0; col < 8; col++) {
            ctx.fillStyle = (row + col) % 3 ? "#183c63" : "#244b78";
            ctx.fillRect(col * 32 + 1, row * 32 + 1, 30, 30);
            ctx.fillStyle = "#527792";
            ctx.fillRect(col * 32 + 15, row * 32 + 2, 1, 28);
        }
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const cells = new T.MeshStandardMaterial({
        map: texture,
        color: 0xc6def8,
        metalness: 0.62,
        roughness: 0.28,
    });
    const box = (
        parent: Three.Object3D,
        size: number[],
        pos: number[],
        mat: Three.Material,
    ) => {
        const mesh = new T.Mesh(
            new T.BoxGeometry(...(size as [number, number, number])),
            mat,
        );
        mesh.position.fromArray(pos);
        parent.add(mesh);
        return mesh;
    };
    const cylinder = (
        parent: Three.Object3D,
        r: number,
        length: number,
        at: number[],
        mat: Three.Material,
    ) => {
        const mesh = new T.Mesh(new T.CylinderGeometry(r, r, length, 24), mat);
        mesh.rotation.x = Math.PI / 2;
        mesh.position.fromArray(at);
        parent.add(mesh);
        return mesh;
    };
    const dish = (parent: Three.Object3D, radius: number, at: number[]) => {
        const profile = Array.from({ length: 13 }, (_, i) => {
            const r = (radius * i) / 12;
            return new T.Vector2(r, (r * r) / (radius * 2.4));
        });
        const shell = new T.Mesh(
            new T.LatheGeometry(profile, 32),
            white.clone(),
        );
        (shell.material as Three.MeshStandardMaterial).side = T.DoubleSide;
        shell.rotation.x = Math.PI / 2;
        shell.position.fromArray(at);
        parent.add(shell);
        cylinder(
            parent,
            0.045,
            radius * 0.65,
            [at[0], at[1], at[2] + radius * 0.4],
            metal,
        );
        return shell;
    };
    const paths: {
        craft: Three.Group;
        a: number;
        e: number;
        rate: number;
        offset: number;
    }[] = [];
    for (let i = 0; i < 2; i++) {
        const orbit = new T.Group();
        orbit.rotation.set(i ? -0.78 : 0.4, i ? 0.25 : -0.22, i ? -0.5 : 0.35);
        const a = i ? 1.44 : 1.23,
            e = i ? 0.065 : 0.025;
        const points = Array.from({ length: 257 }, (_, k) => {
            const angle = (k / 256) * Math.PI * 2;
            return new T.Vector3(
                a * (Math.cos(angle) - e),
                0,
                a * Math.sqrt(1 - e * e) * Math.sin(angle),
            );
        });
        orbit.add(
            new T.Line(
                new T.BufferGeometry().setFromPoints(points),
                new T.LineBasicMaterial({
                    color: i ? 0x95bca6 : 0xdfb67e,
                    transparent: true,
                    opacity: 0.16,
                    depthWrite: false,
                }),
            ),
        );
        const craft = new T.Group();
        craft.scale.setScalar(i ? 0.017 : 0.019);
        craft.name = i
            ? "Aster communications relay"
            : "Horizon orbital observatory";
        box(craft, [2.1, 2.3, 2.9], [0, 0, 0], foil);
        box(craft, [2.25, 2.42, 0.16], [0, 0, -1.48], white);
        box(craft, [2.25, 2.42, 0.16], [0, 0, 1.48], metal);
        for (const x of [-1, 1])
            for (const y of [-1.1, 1.1]) {
                box(craft, [0.12, 0.12, 3.05], [x, y, 0], metal);
                cylinder(craft, 0.16, 0.55, [x, y, -1.7], graphite);
            }
        // Articulated solar wings have cell-level detail, backplates and hinges.
        const wings = new T.Group();
        wings.rotation.x = -0.38;
        craft.add(wings);
        box(wings, [12, 0.13, 0.16], [0, 0, 0], metal);
        for (const side of [-1, 1])
            for (let segment = 0; segment < 3; segment++) {
                const x = side * (2.3 + segment * 1.8);
                box(wings, [1.7, 4.4, 0.1], [x, 0, 0], graphite);
                box(wings, [1.62, 4.3, 0.025], [x, 0, 0.07], cells);
                box(wings, [0.055, 4.4, 0.14], [x - 0.82, 0, 0], metal);
                box(wings, [0.055, 4.4, 0.14], [x + 0.82, 0, 0], metal);
            }
        if (i === 0) {
            cylinder(craft, 0.82, 2.4, [0, 0.15, -2.6], white);
            cylinder(craft, 0.88, 0.18, [0, 0.15, -3.82], graphite);
            cylinder(craft, 0.68, 0.025, [0, 0.15, -3.93], lens);
            dish(craft, 0.78, [0, 1.5, 1.65]);
            for (const side of [-1, 1])
                box(craft, [0.08, 1.8, 2.6], [side * 1.4, 1, 0.3], white);
        } else {
            dish(craft, 2.15, [0, 0, 1.6]);
            box(craft, [0.08, 4.1, 0.08], [0, 2.5, -0.8], metal);
            cylinder(craft, 0.24, 0.8, [0, 4.5, -0.8], white);
            for (const side of [-1, 1])
                cylinder(craft, 0.3, 1.4, [side * 1.25, -1.1, 1.7], graphite);
        }
        orbit.add(craft);
        assembly.add(orbit);
        paths.push({
            craft,
            a,
            e,
            rate: i ? -0.041 : 0.065,
            offset: i ? 2.5 : 0.7,
        });
    }
    assembly.traverse((object) => {
        if ((object as Three.Mesh).isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
        }
    });
    earth.add(assembly);
    let elapsed = 0;
    const basis = new T.Matrix4(),
        normal = new T.Vector3(0, 1, 0),
        radial = new T.Vector3(),
        tangent = new T.Vector3();
    const update = (delta: number) => {
        elapsed += delta;
        for (const { craft, a, e, rate, offset } of paths) {
            const mean = offset + elapsed * rate;
            let anomaly = mean;
            for (let i = 0; i < 4; i++)
                anomaly -=
                    (anomaly - e * Math.sin(anomaly) - mean) /
                    (1 - e * Math.cos(anomaly));
            craft.position.set(
                a * (Math.cos(anomaly) - e),
                0,
                a * Math.sqrt(1 - e * e) * Math.sin(anomaly),
            );
            radial.copy(craft.position).normalize();
            tangent.crossVectors(normal, radial).normalize();
            // Nadir instruments keep pointing toward Earth in the local orbit
            // frame, including while the entire globe moves between chapters.
            craft.quaternion.setFromRotationMatrix(
                basis.makeBasis(tangent, normal, radial),
            );
        }
    };
    update(0);
    return { update, count: paths.length, dispose: () => texture.dispose() };
}
