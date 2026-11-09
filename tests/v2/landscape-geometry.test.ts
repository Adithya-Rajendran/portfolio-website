import { describe, expect, it } from "vitest";
import * as T from "three";
import {
    makeTerrainGrid,
    tileTerrain,
} from "../../src/scripts/landscape-geometry";

describe("landscape geometry", () => {
    it("keeps a nonuniform terrain continuous with upward normals and full texture coverage", () => {
        const geometry = makeTerrainGrid(
            [-4, -1, 0, 0.5, 4],
            [-3, 0, 2],
            (x, z) => x * 0.1 + z * 0.2,
        );
        const normal = geometry.getAttribute("normal");
        const expected = new T.Vector3(-0.1, 1, -0.2).normalize();
        for (let i = 0; i < normal.count; i++)
            expect(
                new T.Vector3()
                    .fromBufferAttribute(normal, i)
                    .distanceTo(expected),
            ).toBeLessThan(0.00001);
        const uv = geometry.getAttribute("uv");
        expect([uv.getX(0), uv.getY(0)]).toEqual([0, 1]);
        expect([uv.getX(uv.count - 1), uv.getY(uv.count - 1)]).toEqual([1, 0]);
        geometry.dispose();
    });

    it("removes only fully covered cells from the distant terrain", () => {
        const axis = [-4, -2, 0, 2, 4];
        const geometry = makeTerrainGrid(
            axis,
            axis,
            () => -2,
            (left, right, back, front) =>
                left >= -2 && right <= 2 && back >= -2 && front <= 2,
        );
        const position = geometry.getAttribute("position");
        const index = geometry.getIndex()!;
        let area = 0;
        for (let i = 0; i < index.count; i += 3) {
            const a = new T.Vector3().fromBufferAttribute(
                position,
                index.getX(i),
            );
            const b = new T.Vector3().fromBufferAttribute(
                position,
                index.getX(i + 1),
            );
            const c = new T.Vector3().fromBufferAttribute(
                position,
                index.getX(i + 2),
            );
            area += new T.Triangle(a, b, c).getArea();
            const center = a.add(b).add(c).divideScalar(3);
            expect(Math.abs(center.x) >= 2 || Math.abs(center.z) >= 2).toBe(
                true,
            );
        }
        expect(area).toBe(64 - 16);
        geometry.dispose();
    });

    it("preserves every triangle and seam attribute while allowing off-camera patches to be culled", () => {
        const axis = Array.from({ length: 21 }, (_, i) => i - 10);
        const source = makeTerrainGrid(
            axis,
            axis,
            (x, z) => Math.sin(x) * 0.1 + Math.cos(z) * 0.2,
        );
        const original = new Map<string, number[]>();
        const positions = source.getAttribute("position");
        const normals = source.getAttribute("normal");
        const uv = source.getAttribute("uv");
        for (let i = 0; i < positions.count; i++)
            original.set(
                [positions.getX(i), positions.getY(i), positions.getZ(i)].join(
                    ",",
                ),
                [
                    normals.getX(i),
                    normals.getY(i),
                    normals.getZ(i),
                    uv.getX(i),
                    uv.getY(i),
                ],
            );
        const triangleCount = source.getIndex()!.count / 3;
        const material = new T.MeshBasicMaterial();
        const root = tileTerrain(source, material, 4, true);
        const camera = new T.PerspectiveCamera(24, 1, 0.1, 25);
        camera.position.set(0, 5, 8);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld(true);
        root.updateMatrixWorld(true);
        const frustum = new T.Frustum().setFromProjectionMatrix(
            new T.Matrix4().multiplyMatrices(
                camera.projectionMatrix,
                camera.matrixWorldInverse,
            ),
        );
        let total = 0,
            visible = 0;
        for (const child of root.children) {
            const mesh = child as T.Mesh;
            const geometry = mesh.geometry;
            total += geometry.getIndex()!.count / 3;
            if (frustum.intersectsObject(mesh)) visible++;
            const position = geometry.getAttribute("position");
            const normal = geometry.getAttribute("normal");
            const patchUv = geometry.getAttribute("uv");
            for (let i = 0; i < position.count; i++) {
                const p = new T.Vector3().fromBufferAttribute(position, i);
                expect(geometry.boundingBox!.containsPoint(p)).toBe(true);
                expect([
                    normal.getX(i),
                    normal.getY(i),
                    normal.getZ(i),
                    patchUv.getX(i),
                    patchUv.getY(i),
                ]).toEqual(original.get(p.toArray().join(",")));
            }
            expect(mesh.receiveShadow).toBe(true);
            geometry.dispose();
        }
        expect(total).toBe(triangleCount);
        expect(visible).toBeGreaterThan(0);
        expect(visible).toBeLessThan(root.children.length / 2);
        material.dispose();
    });
});
