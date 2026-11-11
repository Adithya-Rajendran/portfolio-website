import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
    disposePlanet,
    makePlanet,
    type World,
} from "../../src/scripts/planet-materials";
import { studyWorlds } from "../../src/scripts/study-worlds";

describe("study worlds", () => {
    it("keeps angular size stable throughout the inspection orbit and zoom", () => {
        // The widest home orbit is the narrow-screen camera at z=12.7.
        // Inline orbit keeps the camera within 1.5 times that home radius.
        const cameras = {
            workshop: { eye: 3.7, aim: -0.1 },
            observatory: { eye: 0.3, aim: -0.4 },
            relay: { eye: 0.3, aim: -0.1 },
        };
        for (const kind of Object.keys(studyWorlds) as Array<
            keyof typeof studyWorlds
        >) {
            const {
                position: [x, y, z],
                radius,
            } = studyWorlds[kind];
            const { eye, aim } = cameras[kind];
            const orbitRadius = 1.5 * Math.hypot(12.7, eye - aim);
            const worldDistance = Math.hypot(x, y - aim, z);
            const nearest = worldDistance - orbitRadius;
            const farthest = worldDistance + orbitRadius;
            // Saturn’s rings reach 2.15 times its globe radius.
            const outerRadius = radius * (kind === "observatory" ? 2.15 : 1);
            expect(nearest).toBeGreaterThan(outerRadius);
            const angularDiameter = (distance: number) =>
                2 * Math.asin(outerRadius / distance);
            expect(
                angularDiameter(nearest) / angularDiameter(farthest),
            ).toBeLessThan(1.04);
        }
    });
});

describe("planet detail", () => {
    const lighting = {
        sunDirection: { value: new THREE.Vector3(1, 1, 1) },
        sunColor: { value: new THREE.Color(0xffffff) },
        sunStrength: { value: 1 },
        ambientStrength: { value: 1 },
        twilightStrength: { value: 1 },
        cloudOffset: { value: 0 },
    };

    async function planet(world: World, small: boolean, detail?: "distant") {
        const textures: THREE.Texture[] = [];
        const load = vi.fn(async () => {
            const texture = new THREE.Texture();
            textures.push(texture);
            return texture;
        });
        const group = await makePlanet(
            THREE,
            world,
            small,
            load,
            lighting,
            detail,
        );
        return {
            group,
            load,
            triangles: group.children.reduce((count, child) => {
                const geometry = (child as THREE.Mesh).geometry;
                return (
                    count +
                    (geometry.index?.count ??
                        geometry.getAttribute("position").count) /
                        3
                );
            }, 0),
            dispose() {
                disposePlanet(group);
                textures.forEach((texture) => texture.dispose());
            },
        };
    }

    it.each([
        ["earth", "earth-surface-v2-8k", "earth-surface-v2-2k"],
        ["moon", "moon-surface-v2-4k", "moon-surface-v2-2k"],
        ["saturn", "saturn-strip-v1", "saturn-strip-v1"],
    ] as const)(
        "reduces distant %s geometry while preserving close-up assets",
        async (world, closeMap, distantMap) => {
            const close = await planet(world, false);
            const distant = await planet(world, false, "distant");
            try {
                expect(close.load).toHaveBeenCalledWith(closeMap);
                expect(distant.load).toHaveBeenCalledWith(distantMap);
                const closeSurface = (close.group.children[0] as THREE.Mesh)
                    .geometry as THREE.SphereGeometry;
                const distantSurface = (distant.group.children[0] as THREE.Mesh)
                    .geometry as THREE.SphereGeometry;
                expect([
                    closeSurface.parameters.widthSegments,
                    closeSurface.parameters.heightSegments,
                ]).toEqual([192, 128]);
                expect([
                    distantSurface.parameters.widthSegments,
                    distantSurface.parameters.heightSegments,
                ]).toEqual([64, 48]);
                expect(distant.triangles).toBeLessThan(close.triangles * 0.2);
                if (world === "earth") {
                    // Clouds and water are linear masks read as .r, so they
                    // ask for one-channel uploads; the night lights are sRGB
                    // colour and the normal map is RGB, so they do not.
                    expect(close.load).toHaveBeenCalledWith(
                        "earth-clouds-v2-4k",
                        false,
                        true,
                    );
                    expect(distant.load).toHaveBeenCalledWith(
                        "earth-clouds-v2-2k",
                        false,
                        true,
                    );
                    expect(close.load).toHaveBeenCalledWith(
                        "earth-water-v2-2k",
                        false,
                        true,
                    );
                    expect(close.load).toHaveBeenCalledWith(
                        "earth-lights-v2-4k",
                    );
                    expect(close.load).toHaveBeenCalledWith(
                        "earth-normal-v2-2k",
                        false,
                    );
                }
                if (world === "saturn") {
                    expect(close.load).toHaveBeenCalledWith("saturn-ring-1k");
                    expect(distant.load).toHaveBeenCalledWith("saturn-ring-1k");
                }
            } finally {
                close.dispose();
                distant.dispose();
            }
        },
    );

    it("keeps mobile close-up Earth geometry and texture detail as the default", async () => {
        const close = await planet("earth", true);
        try {
            const surface = (close.group.children[0] as THREE.Mesh)
                .geometry as THREE.SphereGeometry;
            const atmosphere = (close.group.children[2] as THREE.Mesh)
                .geometry as THREE.SphereGeometry;
            expect([
                surface.parameters.widthSegments,
                surface.parameters.heightSegments,
            ]).toEqual([128, 128]);
            expect([
                atmosphere.parameters.widthSegments,
                atmosphere.parameters.heightSegments,
            ]).toEqual([192, 128]);
            expect(close.load).toHaveBeenCalledWith("earth-surface-v2-2k");
        } finally {
            close.dispose();
        }
    });
});
