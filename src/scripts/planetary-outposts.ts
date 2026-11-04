import type * as Three from "three";

// An illustrated scale lets a whole city read from orbit. The geometry stays
// attached to the same globe during descent; metres below are model metres.
export const OUTPOST_SCALE = 0.00065;
const radiusInMetres = 1 / OUTPOST_SCALE;

export function curveSurfacePoint(point: Three.Vector3) {
    point.y +=
        Math.sqrt(
            Math.max(1, radiusInMetres ** 2 - point.x ** 2 - point.z ** 2),
        ) - radiusInMetres;
    return point;
}

export function attachOutpost(
    T: typeof Three,
    group: Three.Group,
    planet: Three.Group,
    world: "moon" | "mars",
) {
    const normal = new T.Vector3(
        world === "moon" ? 0.08 : -0.12,
        0.94,
        world === "moon" ? 0.33 : 0.4,
    ).normalize();
    group.position.copy(normal).multiplyScalar(1.0016);
    group.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), normal);
    group.scale.setScalar(OUTPOST_SCALE);
    group.userData.surfaceNormal = normal;
    group.userData.planetAttached = true;
    planet.add(group);
}

type Keyframe = {
    at: number;
    camera: number[];
    target: number[];
    landmark: string;
};
// Moon positions share the launch clock: arrive at the track, stay through
// departure, tour the inhabited districts, then return before the next launch.
const tours: Record<"moon" | "mars", Keyframe[]> = {
    moon: [
        {
            at: 0,
            camera: [135, 75, 185],
            target: [18, 10, -15],
            landmark: "Selene · Launchport",
        },
        {
            at: 5,
            camera: [120, 48, 75],
            target: [50, 14, -22],
            landmark: "Mass driver · Launch sequence",
        },
        {
            at: 10,
            camera: [118, 66, -38],
            target: [60, 30, -110],
            landmark: "Mass driver · Orbital departure",
        },
        {
            at: 16,
            camera: [95, 80, -100],
            target: [68, 55, -210],
            landmark: "Cargo flight · Solar wings deploying",
        },
        {
            at: 23,
            camera: [-175, 74, 105],
            target: [-65, 8, -36],
            landmark: "Selene · The inhabited ring",
        },
        {
            at: 29,
            camera: [-110, 58, -155],
            target: [-37, 14, -78],
            landmark: "Selene · Science & gardens",
        },
        {
            at: 36,
            camera: [135, 75, 185],
            target: [18, 10, -15],
            landmark: "Selene · Launchport",
        },
    ],
    mars: [
        {
            at: 0,
            camera: [75, 82, 170],
            target: [-35, 12, -55],
            landmark: "Ares · A city beyond Earth",
        },
        {
            at: 9,
            camera: [-160, 72, 75],
            target: [-56, 9, -25],
            landmark: "Ares · Residential rings",
        },
        {
            at: 19,
            camera: [-88, 65, -190],
            target: [-18, 15, -118],
            landmark: "Ares · The biosphere district",
        },
        {
            at: 28,
            camera: [155, 65, -110],
            target: [42, 23, -70],
            landmark: "Ares · Interplanetary harbour",
        },
        {
            at: 36,
            camera: [75, 82, 170],
            target: [-35, 12, -55],
            landmark: "Ares · A city beyond Earth",
        },
    ],
};

export function outpostCamera(
    T: typeof Three,
    group: Three.Group,
    world: "moon" | "mars",
    elapsed: number,
    launchAt?: (second: number) => Three.Vector3,
) {
    const tour = tours[world],
        time = elapsed % 36;
    const index = Math.max(
        0,
        tour.findIndex(
            (frame, i) =>
                i < tour.length - 1 &&
                time >= frame.at &&
                time < tour[i + 1].at,
        ),
    );
    const from = tour[index],
        to = tour[index + 1];
    const blend = T.MathUtils.smootherstep(time, from.at, to.at);
    group.updateWorldMatrix(true, false);
    const point = (a: number[], b: number[]) =>
        group.localToWorld(
            curveSurfacePoint(
                new T.Vector3()
                    .fromArray(a)
                    .lerp(new T.Vector3().fromArray(b), blend),
            ),
        );
    const result = {
        position: point(from.camera, to.camera),
        target: point(from.target, to.target),
        landmark: from.landmark,
    };
    if (world === "moon" && launchAt) {
        const launchView = (second: number) => {
            const position = launchAt(second);
            return {
                position: group.localToWorld(
                    position.clone().add(new T.Vector3(95, 58, 120)),
                ),
                target: group.localToWorld(
                    position.clone().add(new T.Vector3(0, 1.5, 0)),
                ),
            };
        };
        if (time < 5) {
            const initial = tour[0];
            const chase = launchView(5),
                blend = T.MathUtils.smootherstep(time, 0, 5);
            result.position
                .copy(
                    group.localToWorld(
                        curveSurfacePoint(
                            new T.Vector3().fromArray(initial.camera),
                        ),
                    ),
                )
                .lerp(chase.position, blend);
            result.target
                .copy(
                    group.localToWorld(
                        curveSurfacePoint(
                            new T.Vector3().fromArray(initial.target),
                        ),
                    ),
                )
                .lerp(chase.target, blend);
        } else if (time < 19) {
            const chase = launchView(time);
            result.position.copy(chase.position);
            result.target.copy(chase.target);
        } else if (time < 23) {
            const chase = launchView(19),
                district = tour[4],
                blend = T.MathUtils.smootherstep(time, 19, 23);
            result.position
                .copy(chase.position)
                .lerp(
                    group.localToWorld(
                        curveSurfacePoint(
                            new T.Vector3().fromArray(district.camera),
                        ),
                    ),
                    blend,
                );
            result.target
                .copy(chase.target)
                .lerp(
                    group.localToWorld(
                        curveSurfacePoint(
                            new T.Vector3().fromArray(district.target),
                        ),
                    ),
                    blend,
                );
        }
    }
    return result;
}

export async function loadOutpost(world: "moon" | "mars", anisotropy: number) {
    const T = await import("three");
    const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
    const { DRACOLoader } = await import("three/addons/loaders/DRACOLoader.js");
    const { TessellateModifier } =
        await import("three/addons/modifiers/TessellateModifier.js");
    const decoder = new DRACOLoader()
        .setDecoderPath("/draco/")
        .setWorkerLimit(2);
    decoder.setDecoderConfig({ type: "js" });
    let gltf;
    try {
        gltf = await new GLTFLoader()
            .setDRACOLoader(decoder)
            .loadAsync(`/models/${world}-outpost-v2.glb`);
    } finally {
        decoder.dispose();
    }
    const group = gltf.scene;
    group.updateWorldMatrix(true, true);
    // Bake each material batch into the same tangent frame, then conform its
    // surface to the globe. This also keeps the large terrain patch smooth.
    const meshes: Three.Mesh[] = [];
    group.traverse((object) => {
        if ((object as Three.Mesh).isMesh) meshes.push(object as Three.Mesh);
    });
    for (const mesh of meshes) {
        mesh.geometry.applyMatrix4(mesh.matrixWorld);
        const material = Array.isArray(mesh.material)
            ? mesh.material[0]
            : mesh.material;
        if (material.name === "Titanium structure") {
            // Long rails need intermediate vertices before conforming to the
            // globe, so the track, coil frames and payload share one curve.
            const original = mesh.geometry;
            mesh.geometry = new TessellateModifier(22, 4).modify(original);
            original.dispose();
        }
        const positions = mesh.geometry.getAttribute("position");
        const point = new T.Vector3();
        for (let i = 0; i < positions.count; i++) {
            curveSurfacePoint(point.fromBufferAttribute(positions, i));
            positions.setXYZ(i, point.x, point.y, point.z);
        }
        mesh.geometry.computeVertexNormals();
        mesh.geometry.computeBoundingSphere();
        mesh.position.set(0, 0, 0);
        mesh.quaternion.identity();
        mesh.scale.setScalar(1);
        group.add(mesh);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        for (const material of Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]) {
            material.userData.baseOpacity = material.opacity;
            const physical = material as Three.MeshStandardMaterial;
            if (physical.map) physical.map.anisotropy = anisotropy;
            if (material.name === "Ceramic pressure skin") {
                physical.color.setHex(world === "moon" ? 0xa9bcc3 : 0xd1bfa8);
                physical.metalness = 0.32;
                physical.roughness = 0.48;
            }
            if (material.name === "Coated blue glazing") {
                physical.color.setHex(0x164d62);
                physical.emissive.setHex(0x164357);
                physical.emissiveIntensity = 0.8;
                physical.metalness = 0.42;
            }
            if (
                material.name.includes("navigation lights") ||
                material.name.includes("instrument lights")
            ) {
                physical.emissiveIntensity = 3;
                physical.toneMapped = false;
            }

            if (material.name.includes("regolith")) {
                mesh.castShadow = false;
                physical.roughness = 1;
                physical.color.setHex(world === "moon" ? 0xa6abb0 : 0xc9a58b);
                physical.bumpMap = physical.map;
                physical.bumpScale = 0.000045;
                physical.transparent = true;
                physical.depthWrite = true;
                material.userData.keepTransparent = true;
                // The local ground blends into the planet underneath, never
                // into empty space. Only the outer, uninhabited margin fades.
                physical.onBeforeCompile = (shader) => {
                    shader.vertexShader =
                        "varying float vGroundRadius;\n" +
                        shader.vertexShader.replace(
                            "#include <begin_vertex>",
                            "#include <begin_vertex>\nvGroundRadius = length(position.xz);",
                        );
                    shader.fragmentShader =
                        "varying float vGroundRadius;\n" +
                        shader.fragmentShader.replace(
                            "#include <color_fragment>",
                            "#include <color_fragment>\ndiffuseColor.a *= 1.0 - smoothstep(210.0, 315.0, vGroundRadius);",
                        );
                };
            }
        }
    }
    for (const name of ["launch_start", "launch_exit"]) {
        const anchor = group.getObjectByName(name);
        if (!anchor) continue;
        const point = anchor.getWorldPosition(new T.Vector3());
        group.add(anchor);
        anchor.userData.uncurved = point.toArray();
        anchor.position.copy(curveSurfacePoint(point));
    }
    return group;
}

export function disposeOutpost(group: Three.Object3D) {
    const textures = new Set<Three.Texture>(),
        materials = new Set<Three.Material>();
    group.traverse((o) => {
        const mesh = o as Three.Mesh;
        mesh.geometry?.dispose();
        if (!mesh.material) return;
        for (const material of Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]) {
            materials.add(material);
            for (const value of Object.values(material))
                if (value && typeof value === "object" && "isTexture" in value)
                    textures.add(value as Three.Texture);
        }
    });
    textures.forEach((t) => t.dispose());
    materials.forEach((m) => m.dispose());
}
