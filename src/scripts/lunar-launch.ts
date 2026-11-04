import type * as Three from "three";
import { curveSurfacePoint } from "./planetary-outposts";

/** A reusable payload and sled, aligned to anchors exported with the lunar rail. */
export function addLunarLaunch(T: typeof Three, outpost: Three.Group) {
    const startAnchor = outpost.getObjectByName("launch_start");
    const exitAnchor = outpost.getObjectByName("launch_exit");
    if (!startAnchor || !exitAnchor) return;
    outpost.updateWorldMatrix(true, true);
    const start = outpost.worldToLocal(
        startAnchor.getWorldPosition(new T.Vector3()),
    );
    const exit = outpost.worldToLocal(
        exitAnchor.getWorldPosition(new T.Vector3()),
    );
    const railStart = startAnchor.userData.uncurved
        ? new T.Vector3().fromArray(startAnchor.userData.uncurved)
        : start.clone();
    const railExit = exitAnchor.userData.uncurved
        ? new T.Vector3().fromArray(exitAnchor.userData.uncurved)
        : exit.clone();
    const direction = exit.clone().sub(start).normalize();
    const velocity = exit.clone().sub(start).multiplyScalar(0.5);
    const rotation = new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 0, -1),
        direction,
    );
    const assembly = new T.Group();
    assembly.name = "Lunar satellite departures";
    assembly.renderOrder = outpost.renderOrder;
    outpost.add(assembly);
    const payload = new T.Group(),
        sled = new T.Group();
    payload.name = "Rail-launched satellite";
    sled.name = "Returning magnetic carriage";
    payload.renderOrder = sled.renderOrder = outpost.renderOrder;
    payload.quaternion.copy(rotation);
    sled.quaternion.copy(rotation);
    assembly.add(payload, sled);
    const payloadMaterials: Three.Material[] = [];
    const material = (color: number, metalness = 0.5, roughness = 0.45) => {
        const value = new T.MeshStandardMaterial({
            color,
            metalness,
            roughness,
            transparent: true,
        });
        payloadMaterials.push(value);
        return value;
    };
    const foil = material(0xd2a04d, 0.75, 0.4);
    const metal = material(0xc4cbd1, 0.8, 0.3);
    const ceramic = material(0xe7e6d8, 0.2, 0.6);
    const cells = material(0x183b59, 0.6, 0.28);
    const graphite = material(0x16232b, 0.3, 0.6);
    const box = (
        parent: Three.Group,
        size: number[],
        at: number[],
        mat: Three.Material,
    ) => {
        const mesh = new T.Mesh(
            new T.BoxGeometry(...(size as [number, number, number])),
            mat,
        );
        mesh.position.fromArray(at);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parent.add(mesh);
        return mesh;
    };
    box(payload, [2.1, 1.5, 3.5], [0, 0, 0], foil);
    box(payload, [2.2, 0.15, 3.6], [0, 0.8, 0], ceramic);
    for (const z of [-1.55, 1.55])
        box(payload, [2.22, 1.6, 0.12], [0, 0, z], metal);
    box(payload, [1.25, 0.85, 0.22], [0, 0.1, -1.86], graphite);
    const dish = new T.Mesh(
        new T.SphereGeometry(0.58, 20, 10, 0, Math.PI * 2, 0, 0.9),
        ceramic,
    );
    dish.rotation.x = -0.45;
    dish.position.set(0, 0.85, 0.75);
    payload.add(dish);
    box(payload, [0.07, 0.7, 0.07], [0, 1.15, -1.15], metal);
    const grid = new T.LineBasicMaterial({
        color: 0x7699ac,
        transparent: true,
    });
    payloadMaterials.push(grid);
    const gridVertices: number[] = [];
    for (const x of [-0.55, 0, 0.55])
        gridVertices.push(x, 0.065, -1.4, x, 0.065, 1.4);
    for (let z = -1.4; z <= 1.41; z += 0.56)
        gridVertices.push(-0.55, 0.065, z, 0.55, 0.065, z);
    const gridGeometry = new T.BufferGeometry();
    gridGeometry.setAttribute(
        "position",
        new T.Float32BufferAttribute(gridVertices, 3),
    );
    const wings: { group: Three.Group; side: number; segment: number }[] = [];
    for (const side of [-1, 1]) {
        for (let segment = 0; segment < 4; segment++) {
            const group = new T.Group();
            group.renderOrder = outpost.renderOrder;
            box(group, [1.15, 0.1, 2.9], [0, 0, 0], cells);
            group.add(new T.LineSegments(gridGeometry, grid));
            payload.add(group);
            wings.push({ group, side, segment });
        }
    }
    const sledMetal = new T.MeshStandardMaterial({
        color: 0x3a4853,
        metalness: 0.85,
        roughness: 0.4,
    });
    const sledLight = new T.MeshStandardMaterial({
        color: 0x70d4e4,
        emissive: 0x368aaf,
        emissiveIntensity: 1.5,
    });
    box(sled, [3.8, 0.45, 5.3], [0, -1.2, 0], sledMetal);
    for (const side of [-1, 1])
        box(sled, [0.1, 0.15, 4.7], [side * 1.85, -0.93, 0], sledLight);

    // A subtle trajectory trace, not exhaust: the rail supplies acceleration.
    const trailPositions = new Float32Array(48 * 3);
    const trailColors = new Float32Array(48 * 3);
    for (let i = 0; i < 48; i++) {
        const strength = Math.pow(i / 47, 2);
        trailColors.set([0.44 * strength, 0.82 * strength, strength], i * 3);
    }
    const trailGeometry = new T.BufferGeometry();
    trailGeometry.setAttribute(
        "position",
        new T.BufferAttribute(trailPositions, 3),
    );
    trailGeometry.setAttribute("color", new T.BufferAttribute(trailColors, 3));
    const trailMaterial = new T.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        toneMapped: false,
        blending: T.AdditiveBlending,
    });
    const trail = new T.Line(trailGeometry, trailMaterial);
    trail.frustumCulled = false;
    assembly.add(trail);
    const point = new T.Vector3(),
        tangent = new T.Vector3(),
        forward = new T.Vector3(0, 0, -1);
    const pose = (time: number, target: Three.Vector3) => {
        if (time <= 5) return target.copy(start);
        if (time < 10)
            return curveSurfacePoint(
                target
                    .copy(railStart)
                    .lerp(railExit, Math.pow((time - 5) / 5, 2)),
            );
        const flight = Math.min(9, time - 10);
        target.copy(exit).addScaledVector(velocity, flight);
        target.y -= 0.45 * flight * flight;
        return target;
    };
    let previousElapsed = -1;
    let lastState:
        { phase: string; cycle: number; position: Three.Vector3 } | undefined;
    const update = (elapsed: number) => {
        if (elapsed === previousElapsed && lastState) return lastState;
        previousElapsed = elapsed;
        const cycle = Math.floor(elapsed / 36),
            time = elapsed % 36;
        const phase =
            time < 5
                ? "ready"
                : time < 10
                  ? "accelerating"
                  : time < 19
                    ? "coasting"
                    : time < 24
                      ? "resetting"
                      : "ready";
        payload.visible = time < 19 || time >= 24;
        pose(time >= 24 ? 0 : time, payload.position);
        tangent.copy(velocity);
        if (time > 10) tangent.y -= 0.9 * Math.min(9, time - 10);
        payload.quaternion.setFromUnitVectors(forward, tangent.normalize());
        const unfold = T.MathUtils.smoothstep(
            time >= 24 ? 0 : time,
            10.25,
            12.25,
        );
        for (const { group, side, segment } of wings) {
            group.position.set(
                side * (1.45 + segment * (0.1 + 1.16 * unfold)),
                0.3 + (1 - unfold) * segment * 0.13,
                0,
            );
        }
        if (time < 10) pose(time, sled.position);
        else if (time < 19) sled.position.copy(exit);
        else
            curveSurfacePoint(
                sled.position
                    .copy(railExit)
                    .lerp(railStart, T.MathUtils.smoothstep(time, 19, 23.5)),
            );
        const opacity =
            time >= 24 ? 1 : 1 - T.MathUtils.smoothstep(time, 15.5, 19);
        payloadMaterials.forEach((m) => {
            m.opacity = opacity;
        });
        sledLight.emissiveIntensity = phase === "accelerating" ? 3.5 : 1;
        trail.visible = time >= 5 && time < 19;
        trailMaterial.opacity = opacity * 0.55;
        for (let i = 0; i < 48; i++) {
            pose(Math.max(5, time - (1 - i / 47) * 1.2), point);
            point.toArray(trailPositions, i * 3);
        }
        trailGeometry.attributes.position.needsUpdate = true;
        lastState = { phase, cycle, position: payload.position };
        return lastState;
    };
    update(0);
    return {
        update,
        positionAt: (second: number) => pose(second, new T.Vector3()),
    };
}
