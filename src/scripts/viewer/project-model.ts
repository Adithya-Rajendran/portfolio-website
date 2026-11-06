import type * as Three from "three";

export function disposeScene(scene: Three.Object3D) {
    const geometries = new Set<Three.BufferGeometry>();
    const materials = new Set<Three.Material>();
    const textures = new Set<Three.Texture>();
    scene.traverse((object) => {
        const mesh = object as Three.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        for (const material of Array.isArray(mesh.material)
            ? mesh.material
            : mesh.material
              ? [mesh.material]
              : [])
            materials.add(material);
    });
    for (const material of materials) {
        for (const value of Object.values(material))
            if (value && typeof value === "object" && "isTexture" in value)
                textures.add(value as Three.Texture);
        material.dispose();
    }
    geometries.forEach((value) => value.dispose());
    textures.forEach((value) => value.dispose());
}

export async function loadProjectModel(
    THREE: typeof Three,
    group: Three.Group,
    kind: string | undefined,
    url: string | undefined,
    disposed: () => boolean,
) {
    if (kind === "procedural") {
        const dark = new THREE.MeshStandardMaterial({
            color: 0x363a32,
            metalness: 0.45,
            roughness: 0.55,
        });
        const panel = new THREE.MeshStandardMaterial({
            color: 0x6c7460,
            metalness: 0.45,
            roughness: 0.45,
        });
        const accent = new THREE.MeshStandardMaterial({
            color: 0xdfa05d,
            emissive: 0xac5045,
        });
        const box = (
            w: number,
            h: number,
            d: number,
            x: number,
            y: number,
            z: number,
            material: Three.Material,
        ) => {
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(w, h, d),
                material,
            );
            mesh.position.set(x, y, z);
            group.add(mesh);
        };
        for (const x of [-0.75, 0.75])
            for (const z of [-0.5, 0.5]) box(0.08, 2.6, 0.08, x, 0, z, dark);
        for (const y of [-1.25, 1.25]) box(1.6, 0.08, 1.08, 0, y, 0, dark);
        for (let i = 0; i < 6; i++) {
            const y = -0.95 + i * 0.38;
            box(1.4, 0.26, 0.85, 0, y, 0, panel);
            for (let j = 0; j < 4; j++)
                box(0.05, 0.05, 0.02, -0.5 + j * 0.13, y, 0.44, accent);
        }
    } else {
        if (!url) throw new Error("Missing model");
        const parsed = new URL(url, location.href);
        if (parsed.protocol !== "https:" && parsed.origin !== location.origin)
            throw new Error("Invalid model URL");
        const { GLTFLoader } =
            await import("three/addons/loaders/GLTFLoader.js");
        const gltf = await new GLTFLoader().loadAsync(parsed.href);
        if (disposed()) {
            disposeScene(gltf.scene);
            return;
        }
        group.add(gltf.scene);
        const bounds = new THREE.Box3().setFromObject(gltf.scene);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const scale = 2.5 / Math.max(size.x, size.y, size.z, 0.001);
        gltf.scene.position.sub(center);
        group.scale.setScalar(scale);
    }
}
