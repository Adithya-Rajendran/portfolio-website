import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
    arcPosition,
    TERRAIN_RADIUS,
    createExperienceCamera,
} from "../../src/scripts/experience-camera";

function setup() {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 3);
    const input = new THREE.PerspectiveCamera();
    const controls = {
        object: input,
        target: new THREE.Vector3(),
        enableDamping: false,
        minDistance: 2.2,
        minPolarAngle: 0,
        maxPolarAngle: Math.PI,
        update: vi.fn(),
    };
    const rig = createExperienceCamera(
        THREE,
        camera,
        controls as unknown as OrbitControls,
    );
    const globe = new THREE.Group();
    return { camera, input, controls, rig, globe };
}

function pose(position: THREE.Vector3, target = new THREE.Vector3()) {
    return { position, target, up: new THREE.Vector3(0, 1, 0) };
}

describe("experience camera", () => {
    it("takes a finite arc outside the globe to its opposite side", () => {
        const center = new THREE.Vector3(4, -2, 1);
        const start = center.clone().add(new THREE.Vector3(0, 0, 3));
        const end = center.clone().add(new THREE.Vector3(0, 0, -2));
        for (let i = 0; i <= 20; i++) {
            const point = arcPosition(THREE, start, end, center, i / 20);
            expect(point.toArray().every(Number.isFinite)).toBe(true);
            expect(point.distanceTo(center)).toBeGreaterThanOrEqual(2 - 1e-9);
        }
        expect(
            arcPosition(THREE, start, end, center, 0).distanceTo(start),
        ).toBeLessThan(1e-9);
        expect(
            arcPosition(THREE, start, end, center, 1).distanceTo(end),
        ).toBeLessThan(1e-9);
    });

    it("limits a large guided rotation to the allowed frame step", () => {
        const { camera, rig, globe } = setup();
        const options = { instant: false, manual: false, globes: [globe] };
        rig.move(
            pose(new THREE.Vector3(0, 0, 3), new THREE.Vector3(0, 0, 2.9)),
            0.05,
            options,
        );
        const before = camera.quaternion.clone();
        rig.move(
            pose(new THREE.Vector3(0, 0, 3), new THREE.Vector3(0, 0, 6)),
            1,
            options,
        );
        const turn = before.angleTo(camera.quaternion);
        expect(turn).toBeGreaterThan(0);
        expect(turn).toBeLessThanOrEqual((0.1 * Math.PI) / 2 + 1e-8);
    });

    it("bounds focus target movement during a large change", () => {
        const { rig, globe } = setup();
        const options = { instant: false, manual: false, globes: [globe] };
        rig.move(pose(new THREE.Vector3(0, 0, 3)), 0.05, options);
        const before = rig.target.clone();
        rig.move(
            pose(new THREE.Vector3(0, 0, 3), new THREE.Vector3(20, 0, 0)),
            1,
            options,
        );
        expect(rig.target.distanceTo(before)).toBeGreaterThan(0);
        expect(rig.target.distanceTo(before)).toBeLessThanOrEqual(0.7 + 1e-9);
    });

    it("keeps manual proxy changes separate until the rig moves the rendered camera", () => {
        const { camera, input, controls, rig, globe } = setup();
        rig.move(pose(new THREE.Vector3(0, 0, 3)), 0.05, {
            instant: true,
            manual: false,
            globes: [globe],
        });
        rig.beginManual(false);
        const original = camera.position.clone();
        input.position.x += 1;
        expect(camera.position.distanceTo(original)).toBe(0);
        rig.move(rig.manualPose(), 0.05, {
            instant: true,
            manual: true,
            globes: [globe],
        });
        expect(camera.position.distanceTo(original)).toBeGreaterThan(0.9);
        expect(controls.update).toHaveBeenCalled();
    });

    it("keeps a manual camera outside raised surface terrain", () => {
        const { camera, rig, globe } = setup();
        const position = new THREE.Vector3(0, 0, 1.001);
        rig.move(pose(position), 0.05, {
            instant: true,
            manual: true,
            globes: [globe],
        });
        expect(
            camera.position.distanceTo(globe.position),
        ).toBeGreaterThanOrEqual(1.012 - 1e-9);
        expect(camera.quaternion.toArray().every(Number.isFinite)).toBe(true);
    });

    it("honors guided surface poses closer than the orbit control minimum", () => {
        const { camera, controls, rig, globe } = setup();
        controls.minDistance = 2.2;
        const target = new THREE.Vector3(0, 0, 1);
        const position = new THREE.Vector3(0, 0, 1.1);
        rig.move(pose(position, target), 0.05, {
            instant: true,
            manual: false,
            globes: [globe],
        });
        expect(camera.position.distanceTo(position)).toBeLessThan(1e-9);
        expect(camera.position.distanceTo(target)).toBeLessThan(
            controls.minDistance,
        );
        expect(controls.update).not.toHaveBeenCalled();
    });

    describe("over a settlement's drawn ground", () => {
        const ground = {
            globe: new THREE.Vector3(0, 0, 0),
            at: new THREE.Vector3(0, 0, 1.0016),
            reach: 0.26,
            beyond: 0.338,
            radius: 1.00355,
        };
        const ordinary = TERRAIN_RADIUS + 0.001;

        function settle(position: THREE.Vector3, drawn = ground) {
            const { camera, rig, globe } = setup();
            rig.move(pose(position), 0.05, {
                instant: true,
                manual: false,
                globes: [globe],
                ground: drawn,
            });
            return camera.position.distanceTo(globe.position);
        }

        it("lets the camera sit under the ordinary minimum", () => {
            const radius = settle(new THREE.Vector3(0, 0, 1.005));
            expect(radius).toBeLessThan(ordinary);
            expect(radius).toBeCloseTo(1.005, 9);
        });

        it("never lets it below the ground's own radius", () => {
            expect(settle(new THREE.Vector3(0, 0, 1.0))).toBeCloseTo(
                ground.radius,
                9,
            );
        });

        it("applies the ordinary minimum beyond the far distance", () => {
            const far = new THREE.Vector3(1, 0, 0.05).setLength(1.005);
            expect(far.distanceTo(ground.at)).toBeGreaterThan(ground.beyond);
            expect(settle(far)).toBeCloseTo(ordinary, 9);
        });

        it("ignores ground that belongs to a different globe", () => {
            const other = { ...ground, globe: new THREE.Vector3(9, 0, 0) };
            expect(settle(new THREE.Vector3(0, 0, 1.005), other)).toBeCloseTo(
                ordinary,
                9,
            );
        });
    });
});
