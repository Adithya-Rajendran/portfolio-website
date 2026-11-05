import * as T from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { ImprovedNoise } from "three/addons/math/ImprovedNoise.js";

/** A local landscape reflection for the coated optical elements. */
export function makeOpticalEnvironment() {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    const sky = ctx.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, "#030b16");
    sky.addColorStop(0.36, "#36566e");
    sky.addColorStop(0.48, "#d4ae7b");
    sky.addColorStop(0.51, "#a06d40");
    sky.addColorStop(0.64, "#4e3728");
    sky.addColorStop(1, "#10141a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1024, 512);
    const noise = new ImprovedNoise();
    for (let layer = 0; layer < 5; layer++) {
        ctx.fillStyle = ["#5f4936", "#4b3729", "#392b22", "#28211d", "#1a1919"][
            layer
        ];
        ctx.beginPath();
        ctx.moveTo(0, 512);
        for (let x = 0; x <= 1024; x += 2) {
            const u = (x / 1024) * Math.PI * 2;
            const peak =
                noise.noise(Math.cos(u) * 6, Math.sin(u) * 6, layer * 3) * 22 +
                noise.noise(Math.cos(u) * 19, Math.sin(u) * 19, layer * 3) * 8;
            ctx.lineTo(x, 252 + layer * 25 + peak);
        }
        ctx.lineTo(1024, 512);
        ctx.fill();
    }
    const sun = ctx.createRadialGradient(720, 240, 2, 720, 240, 70);
    sun.addColorStop(0, "#ffefc1");
    sun.addColorStop(0.06, "#ffe2a2");
    sun.addColorStop(0.35, "#fbb45444");
    sun.addColorStop(1, "#fbb45400");
    ctx.fillStyle = sun;
    ctx.fillRect(650, 170, 140, 140);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.mapping = T.EquirectangularReflectionMapping;
    return texture;
}

export function makeMachiningRelief() {
    const size = 512,
        data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            const radius = Math.hypot(x - size / 2, y - size / 2);
            const grain =
                Math.sin(radius * 3.7) * 0.5 +
                Math.sin(radius * 11.9) * 0.25 +
                Math.sin(x * 31.7 + y * 57.3) * 0.08;
            const n = 128 + grain * 48,
                i = (y * size + x) * 4;
            data[i] = data[i + 1] = data[i + 2] = n;
            data[i + 3] = 255;
        }
    const texture = new T.DataTexture(data, size, size, T.RGBAFormat);
    texture.magFilter = T.LinearFilter;
    texture.minFilter = T.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
}

/** Weld the shared edge normals of bevelled, machined parts. */
export function smoothMachinedPart(source: T.BufferGeometry) {
    source.deleteAttribute("normal");
    const result = mergeVertices(source, 0.0001);
    result.computeVertexNormals();
    source.dispose();
    return result;
}

/** Fine surface variation in metres, independent of the primitive's UV layout. */
export function finishSurface(
    material: T.MeshStandardMaterial,
    finish: "paint" | "metal" | "stone" = "metal",
) {
    const strength =
        finish === "paint" ? 0.035 : finish === "stone" ? 0.22 : 0.07;
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
            .replace(
                "#include <common>",
                "#include <common>\nvarying vec3 vStudySurface;",
            )
            .replace(
                "#include <begin_vertex>",
                "#include <begin_vertex>\nvStudySurface=position;",
            );
        shader.fragmentShader = shader.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
                varying vec3 vStudySurface;
                float surfaceHash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
                float surfaceNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
                    return mix(mix(mix(surfaceHash(i),surfaceHash(i+vec3(1,0,0)),f.x),mix(surfaceHash(i+vec3(0,1,0)),surfaceHash(i+vec3(1,1,0)),f.x),f.y),
                        mix(mix(surfaceHash(i+vec3(0,0,1)),surfaceHash(i+vec3(1,0,1)),f.x),mix(surfaceHash(i+vec3(0,1,1)),surfaceHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
            `,
            )
            .replace(
                "#include <color_fragment>",
                `#include <color_fragment>
                float surfaceGrain=surfaceNoise(vStudySurface*130.);
                float surfacePatina=surfaceNoise(vStudySurface*9.);
                diffuseColor.rgb*=1.-${strength}*(.4*surfaceGrain+.6*surfacePatina);
            `,
            )
            .replace(
                "#include <roughnessmap_fragment>",
                `#include <roughnessmap_fragment>
                roughnessFactor=clamp(roughnessFactor+(surfaceGrain-.5)*.12+(surfacePatina-.5)*.12,.05,1.);
            `,
            );
    };
    material.customProgramCacheKey = () => `study-surface-${finish}-1`;
    return material;
}
