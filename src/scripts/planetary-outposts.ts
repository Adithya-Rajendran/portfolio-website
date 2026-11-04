import type * as Three from "three";

// Camera and aim points in the model's own metres. Each district gets a slow,
// deliberate pass; visitors can interrupt this at any point to explore freely.
const tours = {
    moon: [
        [
            [65, 110, 235],
            [-5, 8, -12],
        ],
        [
            [-90, 40, 75],
            [-38, 5, -28],
        ],
        [
            [105, 33, 55],
            [48, 6, -35],
        ],
        [
            [20, 48, -135],
            [-4, 6, -70],
        ],
    ],
    mars: [
        [
            [125, 88, 180],
            [-12, 10, -8],
        ],
        [
            [-80, 35, 100],
            [-35, 4, 35],
        ],
        [
            [-110, 46, -65],
            [-52, 6, -48],
        ],
        [
            [105, 55, -20],
            [45, 18, -69],
        ],
    ],
};

export function outpostCamera(
    T: typeof Three,
    group: Three.Group,
    world: "moon" | "mars",
    elapsed: number,
) {
    const tour = tours[world],
        time = elapsed / 10,
        index = Math.floor(time) % tour.length;
    const blend = T.MathUtils.smoothstep(time % 1, 0.15, 0.9);
    const from = tour[index],
        to = tour[(index + 1) % tour.length];
    group.updateWorldMatrix(true, false);
    return {
        position: group.localToWorld(
            new T.Vector3()
                .fromArray(from[0])
                .lerp(new T.Vector3().fromArray(to[0]), blend),
        ),
        target: group.localToWorld(
            new T.Vector3()
                .fromArray(from[1])
                .lerp(new T.Vector3().fromArray(to[1]), blend),
        ),
    };
}

export async function loadOutpost(world: "moon" | "mars", anisotropy: number) {
    const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
    const { DRACOLoader } = await import("three/addons/loaders/DRACOLoader.js");
    const decoder = new DRACOLoader()
        .setDecoderPath("/draco/")
        .setWorkerLimit(2);
    // The small JavaScript decoder works under the existing CSP without adding
    // eval or WebAssembly privileges. Geometry is decoded once, then disposed.
    decoder.setDecoderConfig({ type: "js" });
    let gltf;
    try {
        gltf = await new GLTFLoader()
            .setDRACOLoader(decoder)
            .loadAsync(`/models/${world}-outpost-v1.glb`);
    } finally {
        decoder.dispose();
    }
    const group = gltf.scene;
    group.scale.setScalar(0.014);
    group.position.y = -0.62;
    group.rotation.y = -0.35;
    group.traverse((o) => {
        const mesh = o as Three.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        for (const material of Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]) {
            material.userData.baseOpacity = material.opacity;
            material.transparent = true;
            const physical = material as Three.MeshStandardMaterial;
            if (physical.map) physical.map.anisotropy = anisotropy;
            if (material.name.includes("regolith")) {
                mesh.renderOrder = -1;
                material.userData.keepTransparent = true;
                physical.roughness = 1;
                physical.color.setHex(world === "moon" ? 0x959da7 : 0xc9a58b);
                physical.bumpMap = physical.map;
                physical.bumpScale = 0.0002;
                physical.alphaTest = 0.01;
                // Dissolve the distant ground into the shared sky rather than
                // exposing the rectangular boundary of a finite terrain tile.
                physical.onBeforeCompile = (shader) => {
                    shader.vertexShader =
                        "varying float vGroundRadius;\n" +
                        shader.vertexShader.replace(
                            "#include <begin_vertex>",
                            "#include <begin_vertex>\nvGroundRadius = length((modelMatrix * vec4(position, 1.0)).xz);",
                        );
                    shader.fragmentShader =
                        "varying float vGroundRadius;\n" +
                        shader.fragmentShader.replace(
                            "#include <color_fragment>",
                            "#include <color_fragment>\ndiffuseColor.a *= 1.0 - smoothstep(1.5, 3.8, vGroundRadius);",
                        );
                };
            }
        }
    });
    return group;
}

export function fadeObject(group: Three.Object3D, opacity: number) {
    group.traverse((o) => {
        const mesh = o as Three.Mesh;
        if (!mesh.isMesh && !(o as Three.Line).isLine) return;
        for (const material of Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]) {
            material.userData.baseOpacity ??= material.opacity;
            const effectiveOpacity = material.userData.baseOpacity * opacity;
            const transparent =
                effectiveOpacity < 0.995 || !!material.userData.keepTransparent;
            if (material.transparent !== transparent) {
                material.transparent = transparent;
                material.needsUpdate = true;
            }
            material.opacity = effectiveOpacity;
            material.depthWrite = effectiveOpacity > 0.995;
        }
    });
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
