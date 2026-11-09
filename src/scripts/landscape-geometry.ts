import * as T from "three";

/** Shared grid vertices keep normals continuous as terrain density changes. */
export function makeTerrainGrid(
    xs: readonly number[],
    zs: readonly number[],
    heightAt: (x: number, z: number) => number,
    omitCell?: (
        left: number,
        right: number,
        back: number,
        front: number,
    ) => boolean,
) {
    const positions = new Float32Array(xs.length * zs.length * 3);
    const uvs = new Float32Array(xs.length * zs.length * 2);
    const indices: number[] = [];
    for (let row = 0; row < zs.length; row++) {
        for (let column = 0; column < xs.length; column++) {
            const vertex = row * xs.length + column;
            const x = xs[column],
                z = zs[row];
            positions.set([x, heightAt(x, z), z], vertex * 3);
            uvs.set(
                [
                    (x - xs[0]) / (xs.at(-1)! - xs[0]),
                    (zs.at(-1)! - z) / (zs.at(-1)! - zs[0]),
                ],
                vertex * 2,
            );
            if (row === zs.length - 1 || column === xs.length - 1) continue;
            if (omitCell?.(x, xs[column + 1], z, zs[row + 1])) continue;
            const next = vertex + xs.length;
            indices.push(vertex, next, vertex + 1, vertex + 1, next, next + 1);
        }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new T.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
}

/** Preserve authored normals/UVs while giving each patch a useful culling bound. */
export function tileTerrain(
    source: T.BufferGeometry,
    material: T.Material,
    tileSize: number | { x: number; z: number },
    receiveShadow = false,
) {
    const width = typeof tileSize === "number" ? tileSize : tileSize.x;
    const depth = typeof tileSize === "number" ? tileSize : tileSize.z;
    const tiles = new Map<string, number[]>();
    const positions = source.getAttribute("position");
    const indices = source.getIndex()!;
    for (let i = 0; i < indices.count; i += 3) {
        const triangle = [
            indices.getX(i),
            indices.getX(i + 1),
            indices.getX(i + 2),
        ];
        const x = triangle.reduce((sum, n) => sum + positions.getX(n), 0) / 3;
        const z = triangle.reduce((sum, n) => sum + positions.getZ(n), 0) / 3;
        const key = `${Math.floor(x / width)},${Math.floor(z / depth)}`;
        const tile = tiles.get(key) ?? [];
        tile.push(...triangle);
        tiles.set(key, tile);
    }
    const root = new T.Group();
    for (const triangleIndices of tiles.values()) {
        const vertices = [...new Set(triangleIndices)];
        const remap = new Map(vertices.map((vertex, i) => [vertex, i]));
        const geometry = new T.BufferGeometry();
        for (const [name, attribute] of Object.entries(source.attributes)) {
            const values = new Float32Array(
                vertices.length * attribute.itemSize,
            );
            vertices.forEach((vertex, i) => {
                for (
                    let component = 0;
                    component < attribute.itemSize;
                    component++
                )
                    values[i * attribute.itemSize + component] =
                        attribute.array[
                            vertex * attribute.itemSize + component
                        ];
            });
            geometry.setAttribute(
                name,
                new T.BufferAttribute(values, attribute.itemSize),
            );
        }
        geometry.setIndex(triangleIndices.map((vertex) => remap.get(vertex)!));
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        const mesh = new T.Mesh(geometry, material);
        mesh.receiveShadow = receiveShadow;
        mesh.userData.contactOcclusion = receiveShadow;
        mesh.matrixAutoUpdate = false;
        root.add(mesh);
    }
    source.dispose();
    return root;
}
