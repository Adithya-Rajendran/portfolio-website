import type * as Three from "three";

/** Two instrument satellites; their sizes are enlarged for legibility in this view. */
export function addSatellites(T: typeof Three, earth: Three.Group) {
    const assembly = new T.Group();
    assembly.name = "Earth satellites";
    const metal = new T.MeshStandardMaterial({
        color: 0xcbd1d1,
        metalness: 0.75,
        roughness: 0.35,
    });
    const foil = new T.MeshStandardMaterial({
        color: 0xc39649,
        metalness: 0.75,
        roughness: 0.48,
    });
    const cells = new T.MeshStandardMaterial({
        color: 0x142b46,
        metalness: 0.55,
        roughness: 0.24,
    });
    const grid = new T.MeshStandardMaterial({
        color: 0x637c8c,
        metalness: 0.7,
        roughness: 0.4,
    });
    const white = new T.MeshStandardMaterial({
        color: 0xe6e8e3,
        roughness: 0.7,
    });
    const paths: {
        orbit: Three.Group;
        craft: Three.Group;
        radius: number;
        rate: number;
        offset: number;
    }[] = [];
    const box = (
        parent: Three.Group,
        w: number,
        h: number,
        d: number,
        mat: Three.Material,
        x = 0,
        y = 0,
        z = 0,
    ) => {
        const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z);
        parent.add(m);
        return m;
    };
    for (let i = 0; i < 2; i++) {
        const orbit = new T.Group();
        orbit.rotation.set(i ? -0.68 : 0.52, i ? 0.2 : -0.3, i ? -0.4 : 0.35);
        const radius = i ? 1.29 : 1.17;
        const points = Array.from(
            { length: 257 },
            (_, k) =>
                new T.Vector3(
                    Math.cos((k / 256) * Math.PI * 2) * radius,
                    0,
                    Math.sin((k / 256) * Math.PI * 2) * radius,
                ),
        );
        const line = new T.Line(
            new T.BufferGeometry().setFromPoints(points),
            new T.LineBasicMaterial({
                color: i ? 0x92a77a : 0xd5a468,
                transparent: true,
                opacity: 0.18,
            }),
        );
        orbit.add(line);
        const craft = new T.Group();
        box(craft, 0.042, 0.044, 0.06, foil);
        box(craft, 0.045, 0.006, 0.063, metal, 0, 0.025, 0);
        box(craft, 0.18, 0.004, 0.004, metal);
        for (const side of [-1, 1]) {
            box(craft, 0.08, 0.003, 0.057, cells, side * 0.076, 0, 0);
            for (let column = 0; column < 6; column++)
                box(
                    craft,
                    0.001,
                    0.004,
                    0.057,
                    grid,
                    side * 0.076 - 0.039 + column * 0.015,
                    0,
                    0,
                );
            for (let row = 0; row < 4; row++)
                box(
                    craft,
                    0.08,
                    0.004,
                    0.0007,
                    grid,
                    side * 0.076,
                    0,
                    -0.027 + row * 0.018,
                );
        }
        const dish = new T.Mesh(
            new T.SphereGeometry(0.024, 20, 12, 0, Math.PI * 2, 0, 0.85),
            white,
        );
        dish.rotation.x = Math.PI / 2;
        dish.position.set(0, 0.02, 0.04);
        craft.add(dish);
        box(craft, 0.003, 0.065, 0.003, metal, 0, 0.043, -0.023);
        const sensor = new T.Mesh(
            new T.CylinderGeometry(0.01, 0.012, 0.025, 16),
            metal,
        );
        sensor.rotation.x = Math.PI / 2;
        sensor.position.z = -0.043;
        craft.add(sensor);
        orbit.add(craft);
        assembly.add(orbit);
        paths.push({
            orbit,
            craft,
            radius,
            rate: i ? -0.052 : 0.069,
            offset: i ? 2.1 : 0.38,
        });
    }
    earth.add(assembly);
    let elapsed = 0;
    const update = (delta: number) => {
        elapsed += delta;
        for (const { craft, radius, rate, offset } of paths) {
            const a = offset + elapsed * rate;
            craft.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius);
            craft.lookAt(0, 0, 0);
        }
    };
    update(0);
    return { update, count: paths.length };
}
