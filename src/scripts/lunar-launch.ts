import type * as Three from "three";
import { curveSurfacePoint, settlementParts } from "./planetary-outposts";

/** The launch clock repeats with the tour that watches it, in seconds. */
const CYCLE = 36;
/**
 * The satellite the tour follows leaves at five seconds, slowly enough to be
 * followed. While the tour is elsewhere the driver does its day job: bulk
 * cargo, one canister at each of these seconds, thrown hard.
 */
const CARGO = [15.2, 19.4, 23.6, 27.8];
/** Seconds a canister spends under the coils, and the share of the track. */
const CARGO_DRIVE = 1.7,
    RELEASE = 0.86;
/** The sled lets go at this speed, in track lengths a second. */
const CARGO_SPEED = (2 * RELEASE) / CARGO_DRIVE;
/** Then the last coils catch it, it waits a breath, and runs back empty. */
const CARGO_BRAKE = (2 * (1 - RELEASE)) / CARGO_SPEED,
    CARGO_HOLD = 0.25,
    CARGO_RETURN = 1.9;
/** Seconds a thrown canister is drawn before it is out of sight. */
const CARGO_FLIGHT = 3.4;

/**
 * The lunar mass driver at work: a sled, the satellite the tour follows and
 * the stream of cargo canisters between, aligned to the anchors exported
 * with the track. The model's own sled and canister are used when it has
 * them (`launch_sled`, `launch_payload`), and its coils are lit to suit.
 */
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
    const canisterFoil = new T.MeshStandardMaterial({
        color: 0xc9a04e,
        metalness: 1,
        roughness: 0.4,
    });
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
    const parts = settlementParts(outpost);
    // A part of the model is taken off the seat it was given and carried.
    const carried = (name: string) => {
        const body = parts?.movers.get(name);
        body?.parent?.removeFromParent();
        return body;
    };
    const builtSled = carried("launch_sled");
    if (builtSled) sled.add(builtSled);
    else {
        box(sled, [3.8, 0.45, 5.3], [0, -1.2, 0], sledMetal);
        for (const side of [-1, 1])
            box(sled, [0.1, 0.15, 4.7], [side * 1.85, -0.93, 0], sledLight);
    }

    // Cargo: one canister on the sled or in flight, and one more so the next
    // is already loaded while the last is still in sight.
    const builtCargo = carried("launch_payload");
    const canisters = [0, 1].map((order) => {
        const canister = new T.Group();
        canister.name = "Cargo canister";
        canister.renderOrder = outpost.renderOrder;
        if (builtCargo) {
            const body = order ? builtCargo.clone(true) : builtCargo;
            canister.add(body);
            // The copy's meshes are shown and shadowed with the rest.
            if (order)
                body.traverse((object) => {
                    if ((object as Three.Mesh).isMesh)
                        parts?.meshes.push(object as Three.Mesh);
                });
        } else {
            const drum = new T.Mesh(
                new T.CylinderGeometry(1.2, 1.2, 4.2, 20).rotateX(Math.PI / 2),
                canisterFoil,
            );
            drum.castShadow = true;
            canister.add(drum);
        }
        canister.visible = false;
        assembly.add(canister);
        return canister;
    });
    // What the eye follows once a canister is too far to see: the glow of
    // the charge it left the coils with, drawn out along its path.
    const streakGeometry = new T.BufferGeometry();
    {
        // A white core inside a wider, fainter sheath, both tapering back
        // from the canister and fading as they go.
        const places: number[] = [],
            shades: number[] = [],
            faces: number[] = [];
        for (const [radius, tint] of [
            [0.34, [1, 1, 1]],
            [1.25, [0.2, 0.42, 0.75]],
        ] as const) {
            const cone = new T.CylinderGeometry(
                radius,
                radius * 0.08,
                1,
                10,
                6,
                true,
            )
                .rotateX(-Math.PI / 2)
                .translate(0, 0, 0.5);
            const from = places.length / 3,
                at = cone.getAttribute("position");
            for (let i = 0; i < at.count; i++) {
                places.push(at.getX(i), at.getY(i), at.getZ(i));
                const shade = Math.max(0, 1 - at.getZ(i)) ** 2;
                shades.push(tint[0] * shade, tint[1] * shade, tint[2] * shade);
            }
            for (const index of cone.getIndex()!.array)
                faces.push(from + index);
            cone.dispose();
        }
        streakGeometry.setAttribute(
            "position",
            new T.Float32BufferAttribute(places, 3),
        );
        streakGeometry.setAttribute(
            "color",
            new T.Float32BufferAttribute(shades, 3),
        );
        streakGeometry.setIndex(faces);
    }
    const streaks = canisters.map(() => {
        const material = new T.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            depthWrite: false,
            toneMapped: false,
            blending: T.AdditiveBlending,
            side: T.DoubleSide,
        });
        const streak = new T.Mesh(streakGeometry, material);
        streak.frustumCulled = false;
        streak.visible = false;
        streak.renderOrder = outpost.renderOrder + 1;
        assembly.add(streak);
        return streak;
    });
    // The discharge at the muzzle as a canister leaves it.
    const flashMaterial = new T.MeshBasicMaterial({
        color: 0xbfe6ff,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        blending: T.AdditiveBlending,
    });
    const flash = new T.Mesh(
        new T.TorusGeometry(4.4, 0.5, 8, 44),
        flashMaterial,
    );
    flash.position.copy(exit);
    flash.quaternion.copy(rotation);
    flash.visible = false;
    flash.renderOrder = outpost.renderOrder + 1;
    assembly.add(flash);

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
    // Where the sled is along the track, 0 at the hall to 1 at the muzzle.
    const sledAlong = (time: number) => {
        if (time < 5) return 0;
        if (time < 10) return Math.pow((time - 5) / 5, 2);
        if (time < 10.6) return 1;
        if (time < 13.6) return 1 - T.MathUtils.smoothstep(time, 10.6, 13.6);
        for (const shot of CARGO) {
            const since = time - shot;
            if (since < 0) break;
            if (since < CARGO_DRIVE)
                return RELEASE * Math.pow(since / CARGO_DRIVE, 2);
            const braking = since - CARGO_DRIVE;
            if (braking < CARGO_BRAKE)
                return (
                    RELEASE +
                    CARGO_SPEED * braking -
                    ((CARGO_SPEED / CARGO_BRAKE) * braking * braking) / 2
                );
            const back = braking - CARGO_BRAKE - CARGO_HOLD;
            if (back < 0) return 1;
            if (back < CARGO_RETURN)
                return 1 - T.MathUtils.smoothstep(back, 0, CARGO_RETURN);
        }
        return 0;
    };
    const onRail = (along: number, target: Three.Vector3) =>
        curveSurfacePoint(target.copy(railStart).lerp(railExit, along));
    const released = onRail(RELEASE, new T.Vector3()),
        thrown = exit.clone().sub(start).multiplyScalar(CARGO_SPEED);
    const drive = parts?.drive?.coil.value;
    let previousElapsed = -1;
    let lastState:
        { phase: string; cycle: number; position: Three.Vector3 } | undefined;
    const update = (elapsed: number) => {
        if (elapsed === previousElapsed && lastState) return lastState;
        previousElapsed = elapsed;
        const cycle = Math.floor(elapsed / CYCLE),
            time = elapsed % CYCLE;
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
        // The satellite waits on the sled once the last canister has gone.
        const waiting = time >= CARGO[CARGO.length - 1] + 4.4;
        payload.visible = time < 19 || waiting;
        pose(waiting ? 0 : time, payload.position);
        tangent.copy(velocity);
        if (time > 10 && !waiting) tangent.y -= 0.9 * Math.min(9, time - 10);
        payload.quaternion.setFromUnitVectors(forward, tangent.normalize());
        const unfold = T.MathUtils.smoothstep(waiting ? 0 : time, 10.25, 12.25);
        for (const { group, side, segment } of wings) {
            group.position.set(
                side * (1.45 + segment * (0.1 + 1.16 * unfold)),
                0.3 + (1 - unfold) * segment * 0.13,
                0,
            );
        }
        const along = sledAlong(time);
        onRail(along, sled.position);
        const opacity = waiting
            ? 1
            : 1 - T.MathUtils.smoothstep(time, 15.5, 19);
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

        // Cargo. Each shot has its own canister of the two, in turn.
        let wave = time >= 5 && time < 10 ? along : -1,
            charge = T.MathUtils.smoothstep(time, 2.5, 5) * (time < 10 ? 1 : 0),
            catching = time >= 10 && time < 10.9 ? 1 - (time - 10) / 0.9 : 0,
            discharge =
                time >= 10 && time < 10.5
                    ? Math.exp(-(time - 10) / 0.14) * 0.6
                    : 0;
        canisters.forEach((canister, order) => {
            canister.visible = false;
            streaks[order].visible = false;
        });
        CARGO.forEach((shot, index) => {
            const since = time - shot,
                canister = canisters[index % canisters.length],
                streak = streaks[index % canisters.length];
            // Loaded in the hall a moment before it goes.
            if (since < -1.1 || since >= CARGO_DRIVE + CARGO_FLIGHT) return;
            canister.visible = true;
            canister.quaternion.copy(rotation);
            if (since < CARGO_DRIVE) {
                onRail(sledAlong(Math.max(shot, time)), canister.position);
                charge = Math.max(
                    charge,
                    T.MathUtils.smoothstep(since, -1.1, -0.1),
                );
                if (since >= 0) wave = along;
                return;
            }
            const flight = since - CARGO_DRIVE;
            canister.position.copy(released).addScaledVector(thrown, flight);
            canister.position.y -= 0.81 * flight * flight;
            // The wave runs on with the canister to the muzzle.
            const past = RELEASE + CARGO_SPEED * flight;
            if (past < 1) wave = past;
            else
                discharge = Math.max(
                    discharge,
                    Math.exp(-(flight - (1 - RELEASE) / CARGO_SPEED) / 0.12),
                );
            catching = Math.max(
                catching,
                1 - flight / (CARGO_BRAKE + CARGO_HOLD + 0.3),
            );
            streak.visible = true;
            streak.position.copy(canister.position);
            streak.quaternion.copy(rotation);
            // Longer as it draws away, fainter as the charge bleeds off.
            streak.scale.set(1, 1, 14 + 60 * Math.min(1, flight / 0.5));
            (streak.material as Three.MeshBasicMaterial).opacity =
                0.9 * Math.pow(Math.max(0, 1 - flight / CARGO_FLIGHT), 1.5);
        });
        flash.visible = discharge > 0.02;
        flashMaterial.opacity = Math.min(1, discharge);
        flash.scale.setScalar(1 + 0.5 * (1 - Math.min(1, discharge)));
        drive?.set(wave, charge, Math.max(0, catching), elapsed);
        lastState = { phase, cycle, position: payload.position };
        return lastState;
    };
    update(0);
    return {
        update,
        positionAt: (second: number) => pose(second, new T.Vector3()),
    };
}
