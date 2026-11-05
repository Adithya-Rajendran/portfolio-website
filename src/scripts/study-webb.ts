import * as T from "three";

/** Small optical curvature and tension wrinkles turn broad planes into surfaces. */
export function finishWebbSurfaces(asset: T.Group) {
    asset.updateMatrixWorld(true);
    asset.traverse((object) => {
        if (!(object instanceof T.Mesh) || Array.isArray(object.material))
            return;
        const material = object.material as T.MeshStandardMaterial;
        const mirror =
            /mirror_blinn$/.test(material.name) &&
            !material.name.includes("omni");
        const shield = /shld_(silv|pink)/.test(material.name);
        if (!mirror && !shield) return;
        object.geometry = object.geometry.clone();
        const geo = object.geometry,
            p = geo.getAttribute("position"),
            normals = geo.getAttribute("normal");
        const inverse = object.matrixWorld.clone().invert();
        const normalMatrix = new T.Matrix3().getNormalMatrix(
                object.matrixWorld,
            ),
            inverseNormal = normalMatrix.clone().invert();
        const point = new T.Vector3(),
            normal = new T.Vector3();
        const uv = [];
        for (let i = 0; i < p.count; i++) {
            point.fromBufferAttribute(p, i).applyMatrix4(object.matrixWorld);
            normal
                .fromBufferAttribute(normals, i)
                .applyMatrix3(normalMatrix)
                .normalize();
            if (shield) {
                const x = point.x,
                    z = point.z;
                // Short folds lie on the membrane, with a different phase per layer.
                const crease =
                    Math.sin(x * 7.2 + Math.sin(z * 1.4) * 2.3) *
                    Math.sin(z * 8.1 + x * 0.7);
                const micro =
                    Math.sin(x * 23 + z * 16) * Math.sin(z * 19 - x * 13);
                point.addScaledVector(normal, crease * 0.003 + micro * 0.001);
                uv.push(x * 0.24, z * 0.24);
            } else {
                uv.push((point.y - 2.978) / 6.6, (point.z + 3.05) / 6.1);
                if (Math.abs(normal.x) > 0.9) {
                    const sign = Math.sign(normal.x);
                    normal.y -= sign * (point.y - 6.274) * 0.028;
                    normal.z -= sign * point.z * 0.028;
                    normal.normalize().applyMatrix3(inverseNormal).normalize();
                    normals.setXYZ(i, normal.x, normal.y, normal.z);
                }
            }
            point.applyMatrix4(inverse);
            p.setXYZ(i, point.x, point.y, point.z);
        }
        geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
        if (shield) geo.computeVertexNormals();
    });
}

/** Seamless, multi-scale wrinkle relief, in linear data space. */
export function makeFoilRelief() {
    const N = 512,
        data = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
            const u = (x / N) * Math.PI * 2,
                v = (y / N) * Math.PI * 2;
            const a = Math.sin(u * 5 + Math.sin(v * 3) * 1.4),
                b = Math.sin(v * 7 + Math.sin(u * 4) * 2.1);
            const crease =
                Math.sign(a) *
                Math.pow(Math.abs(a), 0.4) *
                Math.sign(b) *
                Math.pow(Math.abs(b), 0.6);
            const fine = Math.sin(u * 31 + v * 23) * Math.sin(v * 37 - u * 17);
            const value = 128 + crease * 48 + fine * 9;
            const i = (y * N + x) * 4;
            data[i] = data[i + 1] = data[i + 2] = value;
            data[i + 3] = 255;
        }
    const texture = new T.DataTexture(data, N, N, T.RGBAFormat);
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.magFilter = T.LinearFilter;
    texture.minFilter = T.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
}
