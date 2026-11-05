import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** An original, grounded research outpost. Repeated details share one draw per finish. */
export function makeHomeFrontier(
    groundHeightAt: (x: number, z: number) => number,
    environment: T.Texture,
) {
    const root = new T.Group();
    const settlement = new T.Group();
    root.add(settlement);
    const heightAt = (x: number, z: number) => groundHeightAt(x - 2, z - 8);
    const buildings = new T.Group();
    settlement.add(buildings);
    const finish = (color: number, metalness = 0.15, roughness = 0.55) =>
        new T.MeshStandardMaterial({
            color,
            metalness,
            roughness,
            envMap: environment,
            envMapIntensity: 0.25,
        });
    // Weathered panel seams, fasteners, service markings and vents are drawn
    // once into a real material map, so the structure holds up at closer views.
    const panelCanvas = document.createElement("canvas");
    panelCanvas.width = 1024;
    panelCanvas.height = 512;
    const paint = panelCanvas.getContext("2d")!;
    paint.fillStyle = "#c3c1b6";
    paint.fillRect(0, 0, 1024, 512);
    for (let row = 0; row < 4; row++)
        for (let col = 0; col < 8; col++) {
            const x = col * 128,
                y = row * 128;
            const tone = 194 + ((col * 17 + row * 13) % 7);
            paint.fillStyle = `rgb(${tone},${tone},${tone - 7})`;
            paint.fillRect(x + 2, y + 2, 124, 124);
            paint.strokeStyle = "#6f797670";
            paint.lineWidth = 1;
            paint.strokeRect(x + 4, y + 4, 120, 120);
            for (const dx of [8, 120])
                for (const dy of [8, 120]) {
                    paint.fillStyle = "#67706c";
                    paint.fillRect(x + dx - 1, y + dy - 1, 2, 2);
                }
            if ((row + col) % 3 === 0) {
                paint.fillStyle = "#737b76";
                paint.font = "7px monospace";
                paint.fillText(
                    `F / ${String(row * 8 + col).padStart(2, "0")}`,
                    x + 13,
                    y + 106,
                );
                paint.fillStyle = "#b49158";
                paint.fillRect(x + 13, y + 84, 24, 3);
            }
            if ((row + col) % 5 === 0) {
                paint.fillStyle = "#7c8581";
                for (let slat = 0; slat < 6; slat++)
                    paint.fillRect(x + 76, y + 75 + slat * 4, 29, 1);
            }
        }
    let patina = 91;
    for (let i = 0; i < 14000; i++) {
        patina = (patina * 1664525 + 1013904223) >>> 0;
        const x = patina % 1024;
        patina = (patina * 1664525 + 1013904223) >>> 0;
        paint.fillStyle = i % 2 ? "#ffffff0a" : "#303b3312";
        paint.fillRect(x, patina % 512, 1, 1);
    }
    const panels = new T.CanvasTexture(panelCanvas);
    panels.colorSpace = T.SRGBColorSpace;
    panels.anisotropy = 4;
    const ceramic = finish(0xd2cdbb, 0.28, 0.58);
    ceramic.map = panels;
    ceramic.bumpMap = panels;
    ceramic.bumpScale = 0.018;
    const dark = finish(0x202d32, 0.65, 0.42);
    const alloy = finish(0x7d9194, 0.72, 0.34);
    const copper = finish(0xa56e45, 0.62, 0.48);
    const inset = finish(0x596665, 0.55, 0.64);
    const solar = finish(0x172f3b, 0.52, 0.3);
    const vegetation = finish(0x526b44, 0, 0.9);
    const window = new T.MeshStandardMaterial({
        color: 0xe0bc78,
        emissive: 0xd5994e,
        emissiveIntensity: 3,
        roughness: 0.26,
        metalness: 0.15,
    });
    const blue = new T.MeshStandardMaterial({
        color: 0x80b8b6,
        emissive: 0x649f9c,
        emissiveIntensity: 1.15,
        roughness: 0.3,
        metalness: 0.35,
    });
    const glass = new T.MeshStandardMaterial({
        color: 0x91a392,
        metalness: 0,
        roughness: 0.65,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        envMap: environment,
        envMapIntensity: 0.02,
    });

    const mesh = (
        parent: T.Object3D,
        geometry: T.BufferGeometry,
        material: T.Material,
        x = 0,
        y = 0,
        z = 0,
    ) => {
        const object = new T.Mesh(geometry, material);
        object.position.set(x, y, z);
        object.castShadow = parent === buildings;
        object.receiveShadow = true;
        parent.add(object);
        return object;
    };
    const box = (
        parent: T.Object3D,
        material: T.Material,
        x: number,
        y: number,
        z: number,
        w: number,
        h: number,
        d: number,
        radius = 0,
    ) =>
        mesh(
            parent,
            radius
                ? new RoundedBoxGeometry(w, h, d, 2, radius)
                : new T.BoxGeometry(w, h, d),
            material,
            x,
            y,
            z,
        );
    const cylinder = (
        parent: T.Object3D,
        material: T.Material,
        x: number,
        y: number,
        z: number,
        r: number,
        h: number,
        top = r,
    ) => mesh(parent, new T.CylinderGeometry(top, r, h, 24), material, x, y, z);
    const beam = (
        parent: T.Object3D,
        material: T.Material,
        a: T.Vector3,
        b: T.Vector3,
        radius = 0.055,
    ) => {
        const midpoint = a.clone().add(b).multiplyScalar(0.5);
        const result = cylinder(
            parent,
            material,
            midpoint.x,
            midpoint.y,
            midpoint.z,
            radius,
            a.distanceTo(b),
        );
        result.quaternion.setFromUnitVectors(
            new T.Vector3(0, 1, 0),
            b.clone().sub(a).normalize(),
        );
        return result;
    };
    const ring = (
        parent: T.Object3D,
        material: T.Material,
        x: number,
        y: number,
        z: number,
        radius: number,
        tube: number,
    ) => {
        const result = mesh(
            parent,
            new T.TorusGeometry(radius, tube, 6, 64),
            material,
            x,
            y,
            z,
        );
        result.rotation.x = Math.PI / 2;
        return result;
    };
    const batch = (group: T.Group) => {
        group.updateMatrixWorld(true);
        const buckets = new Map<T.Material, T.BufferGeometry[]>();
        const originals = new Set<T.BufferGeometry>();
        group.traverse((child) => {
            if (!(child instanceof T.Mesh) || Array.isArray(child.material))
                return;
            const geometry = child.geometry.index
                ? child.geometry.toNonIndexed()
                : child.geometry.clone();
            geometry.applyMatrix4(child.matrixWorld);
            const parts = buckets.get(child.material) || [];
            parts.push(geometry);
            buckets.set(child.material, parts);
            originals.add(child.geometry);
        });
        group.clear();
        for (const [material, parts] of buckets) {
            const geometry = mergeGeometries(parts, false);
            if (geometry) {
                const result = mesh(group, geometry, material);
                result.castShadow =
                    group === buildings && !material.transparent;
            }
            parts.forEach((part) => part.dispose());
        }
        originals.forEach((geometry) => geometry.dispose());
    };

    function habitat(
        x: number,
        z: number,
        width: number,
        length: number,
        height = 2.4,
    ) {
        const y = heightAt(x, z);
        // Shell, insulated underbody, inset glazing, structural ribs and airlock.
        box(
            buildings,
            dark,
            x,
            y + 0.4,
            z,
            width + 0.15,
            0.4,
            length + 0.1,
            0.15,
        );
        box(
            buildings,
            ceramic,
            x,
            y + height / 2 + 0.6,
            z,
            width,
            height,
            length,
            0.65,
        );
        box(
            buildings,
            dark,
            x,
            y + height + 0.64,
            z,
            width * 0.65,
            0.18,
            length * 0.72,
            0.08,
        );
        // Exposed service layer, roof radiators and separate end-cap cladding.
        box(
            buildings,
            inset,
            x,
            y + 0.75,
            z,
            width + 0.035,
            0.52,
            length * 0.87,
            0.15,
        );
        for (const side of [-1, 1]) {
            const px = x + side * width * 0.23;
            box(
                buildings,
                alloy,
                px,
                y + height + 0.82,
                z,
                width * 0.22,
                0.24,
                length * 0.56,
                0.05,
            );
            for (let rib = 0; rib < 16; rib++)
                box(
                    buildings,
                    dark,
                    px,
                    y + height + 0.97,
                    z - length * 0.25 + rib * length * 0.033,
                    width * 0.19,
                    0.045,
                    0.055,
                );
            box(
                buildings,
                inset,
                x + side * width * 0.38,
                y + height * 0.5 + 0.5,
                z + length / 2 + 0.02,
                width * 0.14,
                height * 0.56,
                0.1,
                0.04,
            );
            for (let line = 0; line < 7; line++)
                box(
                    buildings,
                    alloy,
                    x + side * width * 0.38,
                    y + height * 0.32 + 0.52 + line * 0.085,
                    z + length / 2 + 0.08,
                    width * 0.1,
                    0.026,
                    0.02,
                );
            // Utilities sit inside protection rails along the lower hull.
            const pipe = cylinder(
                buildings,
                copper,
                x + side * (width / 2 + 0.07),
                y + 0.98,
                z,
                0.045,
                length * 0.82,
            );
            pipe.rotation.x = Math.PI / 2;
        }
        box(
            buildings,
            dark,
            x,
            y + height + 0.12,
            z + length / 2 + 0.025,
            width * 0.52,
            0.32,
            0.075,
            0.04,
        );
        box(
            buildings,
            window,
            x,
            y + height + 0.12,
            z + length / 2 + 0.067,
            width * 0.44,
            0.13,
            0.025,
        );
        for (const side of [-1, 1]) {
            for (let j = 0; j < 5; j++) {
                const pz = z - length * 0.35 + j * length * 0.175;
                box(
                    buildings,
                    dark,
                    x + side * (width / 2 + 0.025),
                    y + height * 0.64 + 0.65,
                    pz,
                    0.065,
                    0.64,
                    length * 0.12,
                    0.015,
                );
                box(
                    buildings,
                    window,
                    x + side * (width / 2 + 0.065),
                    y + height * 0.64 + 0.65,
                    pz,
                    0.018,
                    0.39,
                    length * 0.093,
                );
                box(
                    buildings,
                    alloy,
                    x + side * (width / 2 + 0.025),
                    y + height / 2 + 0.56,
                    pz + length * 0.075,
                    0.065,
                    height * 0.74,
                    0.055,
                );
            }
            box(
                buildings,
                blue,
                x + side * (width / 2 + 0.025),
                y + 0.8,
                z,
                0.03,
                0.035,
                length * 0.8,
            );
            for (const end of [-1, 1]) {
                const pz = z + end * length * 0.32;
                beam(
                    buildings,
                    alloy,
                    new T.Vector3(x + side * width * 0.34, y + 1, pz),
                    new T.Vector3(x + side * width * 0.59, y + 0.08, pz),
                    0.1,
                );
                box(
                    buildings,
                    dark,
                    x + side * width * 0.59,
                    y + 0.06,
                    pz,
                    0.65,
                    0.12,
                    0.65,
                    0.06,
                );
            }
        }
        const hatch = cylinder(
            buildings,
            dark,
            x,
            y + 1.5,
            z + length / 2,
            0.88,
            0.3,
        );
        hatch.rotation.x = Math.PI / 2;
        const door = cylinder(
            buildings,
            alloy,
            x,
            y + 1.5,
            z + length / 2 + 0.19,
            0.66,
            0.1,
        );
        door.rotation.x = Math.PI / 2;
        const rim = ring(
            buildings,
            window,
            x,
            y + 1.5,
            z + length / 2 + 0.26,
            0.73,
            0.025,
        );
        rim.rotation.x = 0;
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            const fastener = cylinder(
                buildings,
                copper,
                x + Math.cos(a) * 0.81,
                y + 1.5 + Math.sin(a) * 0.81,
                z + length / 2 + 0.22,
                0.034,
                0.08,
            );
            fastener.rotation.x = Math.PI / 2;
        }
        const port = cylinder(
            buildings,
            dark,
            x,
            y + 1.76,
            z + length / 2 + 0.25,
            0.22,
            0.075,
        );
        port.rotation.x = Math.PI / 2;
        const portGlass = cylinder(
            buildings,
            blue,
            x,
            y + 1.76,
            z + length / 2 + 0.29,
            0.16,
            0.015,
        );
        portGlass.rotation.x = Math.PI / 2;
        box(
            buildings,
            copper,
            x + 0.33,
            y + 1.3,
            z + length / 2 + 0.28,
            0.045,
            0.26,
            0.06,
        );
        box(
            buildings,
            dark,
            x,
            y + 1.48,
            z + length / 2 + 0.26,
            0.045,
            1.2,
            0.02,
        );
        for (let step = 0; step < 4; step++)
            box(
                buildings,
                alloy,
                x,
                y + 0.56 - step * 0.13,
                z + length / 2 + 0.4 + step * 0.3,
                1.55,
                0.15,
                0.35,
            );
        for (const side of [-1, 1]) {
            beam(
                buildings,
                alloy,
                new T.Vector3(x + side * 0.85, y + 0.1, z + length / 2 + 1.35),
                new T.Vector3(x + side * 0.85, y + 0.95, z + length / 2 + 1.35),
                0.032,
            );
            beam(
                buildings,
                alloy,
                new T.Vector3(x + side * 0.85, y + 0.95, z + length / 2 + 1.35),
                new T.Vector3(x + side * 0.85, y + 1.4, z + length / 2 + 0.15),
                0.032,
            );
        }
    }

    habitat(-8, -25, 5.4, 7.5, 3.6);
    habitat(-15, -20, 3.8, 6.2);
    habitat(-9.5, -15.5, 3.4, 5);
    habitat(-3.5, -16.5, 3.6, 5.4);
    habitat(-17, -29, 3.7, 5.8);
    // Connected enclosed passages, not isolated architectural props.
    for (const [x, z, length, rotation] of [
        [-12, -24, 6.5, Math.PI / 2],
        [-8, -19.5, 5, 0],
        [-5.2, -21, 5, 0.55],
        [-15, -25.5, 4, 0],
    ]) {
        const y = heightAt(x, z);
        const corridor = box(
            buildings,
            ceramic,
            x,
            y + 1.15,
            z,
            1.3,
            1.6,
            length,
            0.3,
        );
        corridor.rotation.y = rotation;
        const stripe = box(
            buildings,
            window,
            x,
            y + 1.92,
            z,
            0.13,
            0.04,
            length * 0.95,
        );
        stripe.rotation.y = rotation;
    }

    function dome(x: number, z: number, radius: number) {
        const y = heightAt(x, z) + 0.35;
        cylinder(buildings, ceramic, x, y - 0.15, z, radius + 0.16, 0.5);
        cylinder(buildings, dark, x, y + 0.06, z, radius, 0.12);
        ring(buildings, window, x, y + 0.14, z, radius + 0.06, 0.035);
        const source = new T.IcosahedronGeometry(radius, 2);
        const sourcePoints = source.attributes.position;
        const glazing: number[] = [];
        const struts = new Set<string>();
        const offset = new T.Vector3(x, y, z);
        // Clip the triangular pressure panels at the foundation. Each shared
        // edge gets one physical strut; the glass keeps the real faceted surface.
        for (let i = 0; i < sourcePoints.count; i += 3) {
            const triangle = [0, 1, 2].map((j) =>
                new T.Vector3().fromBufferAttribute(sourcePoints, i + j),
            );
            const polygon: T.Vector3[] = [];
            triangle.forEach((a, j) => {
                const b = triangle[(j + 1) % 3];
                if (a.y >= 0) polygon.push(a);
                if (a.y >= 0 !== b.y >= 0)
                    polygon.push(a.clone().lerp(b, -a.y / (b.y - a.y)));
            });
            if (polygon.length < 3) continue;
            for (let j = 1; j < polygon.length - 1; j++)
                glazing.push(
                    ...polygon[0].toArray(),
                    ...polygon[j].toArray(),
                    ...polygon[j + 1].toArray(),
                );
            polygon.forEach((a, j) => {
                const b = polygon[(j + 1) % polygon.length];
                if (a.distanceToSquared(b) < 0.00001) return;
                const key = [a, b]
                    .map((p) =>
                        p
                            .toArray()
                            .map((v) => v.toFixed(3))
                            .join(","),
                    )
                    .sort()
                    .join("/");
                if (struts.has(key)) return;
                struts.add(key);
                beam(
                    buildings,
                    alloy,
                    a.clone().add(offset),
                    b.clone().add(offset),
                    0.028,
                );
            });
        }
        source.dispose();
        const panels = new T.BufferGeometry();
        panels.setAttribute(
            "position",
            new T.Float32BufferAttribute(glazing, 3),
        );
        panels.computeVertexNormals();
        mesh(buildings, panels, glass, x, y, z);
        for (let row = -2; row <= 2; row++) {
            const length =
                Math.sqrt(
                    Math.max(0, radius * radius - (row * radius * 0.28) ** 2),
                ) * 1.55;
            box(
                buildings,
                dark,
                x + row * radius * 0.28,
                y + 0.18,
                z,
                radius * 0.19,
                0.35,
                length,
                0.08,
            );
            for (let plant = 0; plant < 8; plant++) {
                const green = mesh(
                    buildings,
                    new T.SphereGeometry(radius * 0.09, 12, 8),
                    vegetation,
                    x + row * radius * 0.28,
                    y + radius * 0.17,
                    z - length * 0.4 + plant * length * 0.11,
                );
                green.scale.set(1, 0.85, 1.2);
            }
        }
    }
    dome(0, -26, 3.8);
    dome(5.4, -32, 2.8);
    box(
        buildings,
        ceramic,
        -0.5,
        heightAt(-0.5, -22) + 0.8,
        -22,
        1.5,
        1.4,
        2.3,
        0.2,
    );
    const gardenAirlockY = heightAt(-0.5, -22);
    const gardenDoor = cylinder(
        buildings,
        dark,
        -0.5,
        gardenAirlockY + 0.85,
        -20.8,
        0.54,
        0.1,
    );
    gardenDoor.rotation.x = Math.PI / 2;
    const gardenRim = ring(
        buildings,
        window,
        -0.5,
        gardenAirlockY + 0.85,
        -20.73,
        0.45,
        0.022,
    );
    gardenRim.rotation.x = 0;

    // Photovoltaic wings with visible cell construction and support frames.
    for (let row = 0; row < 2; row++)
        for (let col = 0; col < 4; col++) {
            const x = -21 + col * 2.6,
                z = -11 + row * 2.7;
            const y = heightAt(x, z);
            const panel = new T.Group();
            box(panel, alloy, 0, 0, 0, 2.25, 0.12, 1.8);
            for (let a = 0; a < 4; a++)
                for (let b = 0; b < 3; b++)
                    box(
                        panel,
                        solar,
                        -0.83 + a * 0.55,
                        0.075,
                        -0.55 + b * 0.55,
                        0.51,
                        0.025,
                        0.51,
                    );
            panel.position.set(x, y + 0.85, z);
            panel.rotation.x = -0.3;
            buildings.add(panel);
            cylinder(buildings, alloy, x, y + 0.42, z, 0.07, 0.85);
        }

    // Walkways read as paths across the ground, with continuous graded edges.
    const route = new T.CatmullRomCurve3([
        new T.Vector3(5, 0, 2),
        new T.Vector3(4, 0, -6),
        new T.Vector3(-1, 0, -11),
        new T.Vector3(-7, 0, -11),
        new T.Vector3(-12, 0, -15),
    ]);
    for (let side = -1; side <= 1; side += 2) {
        const points = route.getPoints(90).map((point, index) => {
            const tangent = route.getTangent(index / 90);
            point.x += tangent.z * side * 0.7;
            point.z -= tangent.x * side * 0.7;
            point.y = heightAt(point.x, point.z) + 0.05;
            return point;
        });
        mesh(
            buildings,
            new T.TubeGeometry(
                new T.CatmullRomCurve3(points),
                90,
                0.028,
                4,
                false,
            ),
            copper,
        );
        points.forEach((point, index) => {
            if (index % 9) return;
            cylinder(
                buildings,
                dark,
                point.x,
                point.y + 0.2,
                point.z,
                0.045,
                0.4,
            );
            cylinder(
                buildings,
                window,
                point.x,
                point.y + 0.42,
                point.z,
                0.047,
                0.12,
            );
        });
    }

    // The communications array is a real parabolic reflector with a feed assembly.
    const dish = new T.Group();
    const dishShape = new T.Group();
    const profile = Array.from({ length: 24 }, (_, i) => {
        const r = (i / 23) * 2.1;
        return new T.Vector2(r, r * r * 0.17);
    });
    const reflector = ceramic.clone();
    reflector.side = T.DoubleSide;
    mesh(dishShape, new T.LatheGeometry(profile, 64), reflector);
    ring(dishShape, alloy, 0, 0.75, 0, 2.1, 0.055);
    for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        beam(
            dishShape,
            alloy,
            new T.Vector3(Math.cos(a) * 1.9, 0.63, Math.sin(a) * 1.9),
            new T.Vector3(0, 2.1, 0),
            0.04,
        );
    }
    cylinder(dishShape, copper, 0, 2.15, 0, 0.16, 0.48);
    batch(dishShape);
    dishShape.rotation.x = 0.82;
    dish.add(dishShape);
    dish.position.set(-8, 6.25, -25);
    settlement.add(dish);
    cylinder(buildings, alloy, -8, 4.65, -25, 0.24, 3);
    cylinder(buildings, dark, -8, 5.6, -25, 0.48, 0.6);

    for (const [x, z, h] of [
        [-17, -21, 6.8],
        [-3, -22, 5.2],
        [-12, -30, 8.3],
    ]) {
        const y = heightAt(x, z);
        cylinder(buildings, alloy, x, y + h / 2, z, 0.065, h, 0.035);
        for (let i = 0; i < 4; i++)
            ring(
                buildings,
                dark,
                x,
                y + h - 0.8 - i * 0.25,
                z,
                0.18 - i * 0.02,
                0.035,
            );
        cylinder(buildings, window, x, y + h + 0.05, z, 0.08, 0.12);
    }

    // Launch infrastructure stays on the distant horizon, at a believable scale.
    const launch = new T.Group();
    buildings.add(launch);
    const launchX = 1,
        launchZ = -70,
        launchY = heightAt(launchX, launchZ);
    cylinder(launch, dark, launchX, launchY + 0.12, launchZ, 3.8, 0.3);
    ring(launch, window, launchX, launchY + 0.3, launchZ, 3.3, 0.035);
    const rocketProfile = [
        [0.78, 0],
        [0.9, 0.5],
        [0.9, 8.8],
        [0.83, 10.6],
        [0.55, 12],
        [0.12, 13.2],
        [0, 13.5],
    ];
    mesh(
        launch,
        new T.LatheGeometry(
            rocketProfile.map(([r, y]) => new T.Vector2(r, y)),
            40,
        ),
        ceramic,
        launchX,
        launchY + 1.5,
        launchZ,
    );
    // The vehicle rests in a service cradle: visible engine bells, hold-down
    // legs and a wide concrete footing make its contact with the ridge clear.
    cylinder(launch, inset, launchX, launchY + 0.16, launchZ, 4.5, 0.42);
    ring(launch, dark, launchX, launchY + 0.6, launchZ, 1.25, 0.16);
    for (let leg = 0; leg < 4; leg++) {
        const a = (leg / 4) * Math.PI * 2 + Math.PI / 4;
        const x = launchX + Math.cos(a) * 1.2;
        const z = launchZ + Math.sin(a) * 1.2;
        beam(
            launch,
            dark,
            new T.Vector3(x, launchY + 0.3, z),
            new T.Vector3(x, launchY + 1.7, z),
            0.12,
        );
        cylinder(launch, dark, x, launchY + 0.35, z, 0.32, 0.12);
        cylinder(
            launch,
            alloy,
            launchX + Math.cos(a) * 0.35,
            launchY + 1.2,
            launchZ + Math.sin(a) * 0.35,
            0.24,
            0.55,
            0.11,
        );
    }
    for (const side of [-1, 1]) {
        box(
            launch,
            dark,
            launchX + side * 1.2,
            launchY + 1.2,
            launchZ,
            0.15,
            2.4,
            1.2,
        );
        for (const depth of [-1, 1])
            beam(
                launch,
                alloy,
                new T.Vector3(
                    launchX - 3.3 + side * 0.7,
                    launchY,
                    launchZ + depth * 0.7,
                ),
                new T.Vector3(
                    launchX - 3.3 + side * 0.7,
                    launchY + 14,
                    launchZ + depth * 0.7,
                ),
                0.12,
            );
    }
    for (let floor = 0; floor < 7; floor++) {
        box(
            launch,
            alloy,
            launchX - 3.3,
            launchY + floor * 2,
            launchZ,
            1.7,
            0.15,
            1.7,
        );
        beam(
            launch,
            copper,
            new T.Vector3(launchX - 4, launchY + floor * 2, launchZ + 0.7),
            new T.Vector3(
                launchX - 2.6,
                launchY + floor * 2 + 2,
                launchZ + 0.7,
            ),
            0.055,
        );
    }
    box(launch, alloy, launchX - 1.9, launchY + 9, launchZ, 2.8, 0.25, 0.4);
    const launchScale = 0.65;
    launch.scale.setScalar(launchScale);
    launch.position.set(
        launchX * (1 - launchScale),
        launchY * (1 - launchScale),
        launchZ * (1 - launchScale),
    );
    batch(buildings);

    // Coaxial survey drone: passive rotor discs, no strobing blades or motion blur pass.
    const drone = new T.Group();
    box(drone, ceramic, 0, 0, 0, 0.64, 0.22, 0.92, 0.11);
    box(drone, dark, 0, -0.14, 0.25, 0.24, 0.2, 0.25, 0.035);
    const lens = cylinder(drone, blue, 0, -0.15, 0.4, 0.065, 0.06);
    lens.rotation.x = Math.PI / 2;
    for (const side of [-1, 1])
        for (const end of [-1, 1]) {
            const x = side * 0.62,
                z = end * 0.4;
            beam(
                drone,
                alloy,
                new T.Vector3(side * 0.2, 0, end * 0.24),
                new T.Vector3(x, 0.05, z),
                0.035,
            );
            cylinder(drone, dark, x, 0.1, z, 0.07, 0.17);
            ring(drone, dark, x, 0.19, z, 0.29, 0.02);
            cylinder(drone, alloy, x, 0.19, z, 0.26, 0.007);
            beam(
                drone,
                dark,
                new T.Vector3(side * 0.25, -0.08, end * 0.3),
                new T.Vector3(side * 0.36, -0.32, end * 0.38),
                0.023,
            );
        }
    batch(drone);
    settlement.add(drone);

    const scanGeometry = new T.PlaneGeometry(14, 14, 70, 70);
    scanGeometry.rotateX(-Math.PI / 2);
    scanGeometry.translate(2, 0, 0);
    const positions = scanGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++)
        positions.setY(
            i,
            groundHeightAt(positions.getX(i), positions.getZ(i)) + 0.035,
        );
    const scanMaterial = new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
        uniforms: { time: { value: 0 } },
        vertexShader: `varying vec2 vLocal; void main(){vLocal=uv*14.-7.; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `uniform float time; varying vec2 vLocal;
            void main(){
                float radius=length(vLocal), wave=fract(time*.055+.24)*8.;
                float band=exp(-pow((radius-wave)/.45,2.));
                vec2 cell=abs(fract(vLocal*2.)-.5);
                float grid=1.-smoothstep(.015,.05,min(cell.x,cell.y));
                float fade=(1.-smoothstep(5.,7.,radius))*smoothstep(.6,1.4,radius);
                gl_FragColor=vec4(vec3(.35,.73,.72),(band*.13+band*grid*.45)*fade);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }`,
    });
    const scan = new T.Mesh(scanGeometry, scanMaterial);
    root.add(scan);

    function update(time: number) {
        scanMaterial.uniforms.time.value = time;
        dish.rotation.y = -0.45 + Math.sin(time * 0.055) * 0.16;
        const angle = time * 0.07 + 0.35;
        drone.position.set(
            -4 + Math.sin(angle) * 6,
            4.6 + Math.sin(time * 0.45) * 0.12,
            -16 + Math.cos(angle) * 3.5,
        );
        drone.rotation.set(
            Math.sin(time * 0.3) * 0.025,
            -angle + Math.PI / 2,
            Math.cos(angle) * 0.06,
        );
    }
    // Apply after batching: the merged vertices remain in settlement space.
    settlement.position.set(-2, 0, -8);
    update(0);
    return { root, update };
}
