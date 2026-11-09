import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { ImprovedNoise } from "three/addons/math/ImprovedNoise.js";
import {
    mergeGeometries,
    mergeVertices,
} from "three/addons/utils/BufferGeometryUtils.js";
import { homeCoverFrame, type HomeFraming } from "../lib/home-framing";
import { makeHomeFrontier } from "./home-frontier";
import { makeHomeRendering } from "./home-rendering";
import { makeTerrainGrid, tileTerrain } from "./landscape-geometry";
import { HOME_SUN_DIRECTION, makeHomeEnvironment } from "./home-lighting";

// The composed view and freely explorable scene share the same real geometry.
export function makeHomeLandscape(renderer: T.WebGLRenderer) {
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(34, 1, 0.1, 650);
    const textures = new Set<T.Texture>();
    let disposed = false;
    const noise = new ImprovedNoise();
    let seed = 61;
    const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const roughness = (x: number, z: number) =>
        noise.noise(x * 0.085, z * 0.085, 7) * 1.65 +
        noise.noise(x * 0.24, z * 0.24, 11) * 0.34 +
        noise.noise(x * 0.8, z * 0.8, 4) * 0.07;
    const heightAt = (x: number, z: number) => {
        const t = T.MathUtils.smoothstep(Math.hypot(x - 2, z), 3.4, 9);
        const terrain =
            (roughness(x, z) - Math.max(0, -z - 7) * 0.035) * t - 0.035;
        const district =
            1 -
            T.MathUtils.smoothstep(Math.hypot((x + 10) / 1.25, z + 31), 12, 22);
        // A shallow graded pad keeps the launch footing on continuous terrain.
        const launchRidge =
            1 - T.MathUtils.smoothstep(Math.hypot(x + 1, z + 78), 5, 13);
        return T.MathUtils.lerp(
            T.MathUtils.lerp(terrain, -0.3, district),
            -1.5,
            launchRidge,
        );
    };
    scene.fog = new T.FogExp2(0x293844, 0.0038);

    const environment = makeHomeEnvironment(renderer);
    // Reflection lighting belongs to the rover's metal. The rough landscape
    // uses direct and sky light, avoiding expensive reflection samples per pixel.
    scene.add(new T.HemisphereLight(0xa7c4df, 0x635041, 1.35));
    const sun = new T.DirectionalLight(0xffcda0, 2.1);
    sun.target.position.set(-4, 0, -15);
    sun.position
        .copy(sun.target.position)
        .addScaledVector(HOME_SUN_DIRECTION, 130);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
        left: -30,
        right: 30,
        top: 30,
        bottom: -30,
        near: 1,
        far: 165,
    });
    sun.shadow.bias = -0.00008;
    sun.shadow.normalBias = 0.065;
    sun.shadow.radius = 2.8;
    scene.add(sun, sun.target);
    const fill = new T.DirectionalLight(0xb0cee6, 0.95);
    fill.position.set(4, 6, 10);
    scene.add(fill);

    const groundMaterial = new T.MeshStandardMaterial({
        color: 0xa9937c,
        roughness: 0.98,
        bumpScale: 0.14,
    });
    // Fixed world-space texture scales avoid swimming while exploring. Fine
    // grain fades into broad mineral variation instead of a repeating horizon.
    groundMaterial.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
            .replace(
                "#include <common>",
                "#include <common>\nvarying float terrainDistance; varying vec2 terrainXZ;",
            )
            .replace(
                "#include <worldpos_vertex>",
                `#include <worldpos_vertex>
                vec3 terrainWorld=(modelMatrix*vec4(transformed,1.)).xyz;
                terrainDistance=length(cameraPosition-terrainWorld);
                terrainXZ=terrainWorld.xz;`,
            );
        shader.fragmentShader = shader.fragmentShader
            .replace(
                "#include <common>",
                "#include <common>\nvarying float terrainDistance; varying vec2 terrainXZ;",
            )
            .replace(
                "#include <map_fragment>",
                `
                #ifdef USE_MAP
                    float distant=smoothstep(28.,110.,terrainDistance);
                    vec4 mineral;
                    if(distant<1.) mineral=texture2D(map,vMapUv);
                    if(distant>0.) {
                        vec4 broad=texture2D(map,vMapUv*.08);
                        mineral=distant<1.?mix(mineral,broad,distant):broad;
                    }
                    diffuseColor*=mineral;
                #endif
                float route=-terrainXZ.y;
                float trailCenter=2.+.012*pow(max(0.,route-3.),2.);
                float trackDistance=min(abs(terrainXZ.x-trailCenter-1.5),abs(terrainXZ.x-trailCenter+1.5));
                float trail=(1.-smoothstep(.14,.25,trackDistance))*smoothstep(1.7,3.,route)*(1.-smoothstep(13.,19.,route));
                float tread=smoothstep(.5,.95,abs(sin(route*13.+trackDistance*5.)));
                diffuseColor.rgb*=1.-trail*(.06+.09*tread);`,
            )
            .replace(
                "#include <normal_fragment_maps>",
                `
                float terrainDetail=1.-smoothstep(18.,100.,terrainDistance);
                if(terrainDetail>0.) {
                    vec3 terrainNormal=normal;
                    #include <normal_fragment_maps>
                    normal=normalize(mix(terrainNormal,normal,terrainDetail));
                }`,
            );
    };
    groundMaterial.customProgramCacheKey = () => "explorable-regolith-v1";
    const distantHeight = (x: number, z: number) =>
        -12 +
        T.MathUtils.smoothstep(Math.hypot(x, z + 30), 90, 190) *
            (6 + noise.noise(x * 0.018, z * 0.018, 17) * 8);
    const terrainHeight = (x: number, z: number) => {
        const edge = Math.min(90 - Math.abs(x), 90 - Math.abs(z + 50));
        return T.MathUtils.lerp(
            distantHeight(x, z),
            heightAt(x, z),
            T.MathUtils.smoothstep(edge, 0, 18),
        );
    };
    const axis = (bands: number[][]) => {
        const values = [bands[0][0]];
        for (const [from, to, step] of bands) {
            const count = Math.ceil((to - from) / step);
            for (let i = 1; i <= count; i++)
                values.push(T.MathUtils.lerp(from, to, i / count));
        }
        return values;
    };
    // Resolve the rover and settlement more finely than the old uniform grid,
    // spending fewer vertices on distant terrain and outside the composed view.
    const groundGeometry = makeTerrainGrid(
        axis([
            [-90, -50, 4],
            [-50, -24, 2],
            [-24, 24, 0.75],
            [24, 50, 2],
            [50, 90, 4],
        ]),
        axis([
            [-140, -100, 4],
            [-100, -60, 2],
            [-60, -45, 1.5],
            [-45, 15, 0.75],
            [15, 40, 2],
        ]),
        terrainHeight,
    );
    const vertices = groundGeometry.attributes.position;
    const colors = new Float32Array(vertices.count * 3);
    const dust = new T.Color();
    for (let i = 0; i < vertices.count; i++) {
        const x = vertices.getX(i),
            z = vertices.getZ(i);
        dust.setScalar(0.72 + noise.noise(x * 0.14, z * 0.14, 6) * 0.22);
        dust.toArray(colors, i * 3);
    }
    groundGeometry.setAttribute("color", new T.BufferAttribute(colors, 3));
    groundMaterial.vertexColors = true;
    scene.add(tileTerrain(groundGeometry, groundMaterial, 60, true));

    // Complete the terrain behind the authored view so a full orbit never
    // reveals the edge of the detailed foreground mesh.
    const distantAxis = axis([[-600, 600, 18.75]]);
    const distantGeometry = makeTerrainGrid(
        distantAxis,
        distantAxis,
        distantHeight,
        // Only remove cells entirely underneath the detailed terrain.
        (left, right, back, front) =>
            left >= -80 && right <= 80 && back >= -130 && front <= 30,
    );
    const distantPoints = distantGeometry.attributes.position;
    const distantUv = distantGeometry.attributes.uv;
    for (let i = 0; i < distantPoints.count; i++) {
        distantUv.setXY(
            i,
            (distantUv.getX(i) * 1200) / 180,
            (distantUv.getY(i) * 1200) / 180,
        );
    }
    distantGeometry.setAttribute(
        "color",
        new T.BufferAttribute(
            new Float32Array(distantPoints.count * 3).fill(0.72),
            3,
        ),
    );
    const distantGround = new T.Mesh(distantGeometry, groundMaterial);
    distantGround.matrixAutoUpdate = false;
    scene.add(distantGround);

    // Layered, continuous ridges fade into the haze. Smooth vertex normals avoid
    // the faceted terrain and sharp joins of isolated low-poly mountain pieces.
    const ridgeHeight = (x: number, z: number, layer: number) => {
        let ridge = 0,
            amplitude = 1,
            frequency = 0.014;
        for (let octave = 0; octave < 3; octave++) {
            ridge +=
                (1 -
                    Math.abs(
                        noise.noise(
                            x * frequency,
                            z * frequency,
                            3 + layer * 7,
                        ),
                    )) *
                amplitude;
            frequency *= 2.05;
            amplitude *= 0.48;
        }
        const envelope = Math.exp(-Math.pow((z + 105 + layer * 65) / 31, 2));
        return -8 + envelope * Math.max(0, ridge - 0.65) * (13 + layer * 3);
    };
    const ridgeMaterials: T.MeshStandardMaterial[] = [];
    const ridgeGeometries: T.BufferGeometry[] = [];
    const ridgeMaterial = new T.MeshStandardMaterial({
        color: 0x725542,
        roughness: 1,
        bumpScale: 0.3,
    });
    ridgeMaterials.push(ridgeMaterial);
    for (let layer = 0; layer < 4; layer++) {
        const geometry = new T.PlaneGeometry(
            680,
            110,
            [192, 144, 112, 80][layer],
            [36, 28, 20, 16][layer],
        );
        geometry.rotateX(-Math.PI / 2);
        geometry.translate(0, 0, -105 - layer * 65);
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i),
                z = positions.getZ(i);
            positions.setY(i, ridgeHeight(x, z, layer));
        }
        geometry.computeVertexNormals();
        ridgeGeometries.push(geometry);
    }
    scene.add(
        tileTerrain(mergeGeometries(ridgeGeometries, false)!, ridgeMaterial, {
            x: 170,
            z: Infinity,
        }),
    );
    ridgeGeometries.forEach((geometry) => geometry.dispose());

    const rockMaterial = new T.MeshStandardMaterial({
        color: 0x685345,
        roughness: 0.95,
    });
    for (let variant = 0; variant < 4; variant++) {
        const rockGeometry = (detail: number) => {
            const source = new T.IcosahedronGeometry(1, detail);
            source.deleteAttribute("normal");
            const geometry = mergeVertices(source);
            source.dispose();
            const points = geometry.attributes.position;
            for (let i = 0; i < points.count; i++) {
                const x = points.getX(i),
                    y = points.getY(i),
                    z = points.getZ(i);
                const distortion =
                    0.84 +
                    noise.noise(x * 2.5, y * 2.5, z * 2.5 + variant * 7) * 0.24;
                points.setXYZ(
                    i,
                    x * distortion,
                    y * distortion * 0.55,
                    z * distortion,
                );
            }
            geometry.computeVertexNormals();
            return geometry;
        };
        // Pebbles remain textured, but do not need the topology of boulders.
        const pebbles = new T.InstancedMesh(rockGeometry(0), rockMaterial, 80);
        const rocks = new T.InstancedMesh(rockGeometry(2), rockMaterial, 30);
        const pose = new T.Object3D();
        for (let i = 0; i < 110; i++) {
            let x = random() * 68 - 30,
                z = random() * 60 - 44;
            if (Math.hypot(x - 2, z) < 3.6) {
                x += 5;
                z -= 3;
            }
            const size =
                i < 80 ? 0.035 + random() * 0.14 : 0.2 + random() * 0.65;
            pose.position.set(x, heightAt(x, z) + size * 0.13, z);
            pose.scale.set(size * (0.8 + random() * 0.9), size, size);
            pose.rotation.set(
                random() * 0.3,
                random() * Math.PI * 2,
                random() * 0.2,
            );
            pose.updateMatrix();
            if (i < 80) pebbles.setMatrixAt(i, pose.matrix);
            else rocks.setMatrixAt(i - 80, pose.matrix);
        }
        for (const instances of [pebbles, rocks]) {
            instances.castShadow = true;
            instances.receiveShadow = true;
            instances.userData.contactOcclusion = true;
            scene.add(instances);
        }
    }

    // An astronomical backdrop seen through a thin, dusty, amber horizon.
    // No giant planet intersecting the surface: the landscape is the subject.
    const skyMaterial = new T.ShaderMaterial({
        side: T.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
            galaxy: { value: null as T.Texture | null },
            sunDirection: { value: HOME_SUN_DIRECTION },
        },
        vertexShader: `varying vec3 vDirection; void main() {vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `uniform sampler2D galaxy; uniform vec3 sunDirection; varying vec3 vDirection;
            void main(){
                vec3 d=normalize(vDirection);
                float h=max(0.,d.y);
                vec3 sky=mix(vec3(.046,.052,.063),vec3(.003,.010,.022),smoothstep(0.,.42,h));
                float angle=max(0.,1.-dot(d,sunDirection));
                sky+=vec3(1.,.43,.16)*(.055*exp(-angle*12.)+.25*exp(-angle*180.));
                sky+=vec3(1.,.80,.56)*2.5*exp(-angle*65000.);
                vec2 uv=vec2(atan(d.z,d.x)/6.283185+.5,asin(d.y)/3.14159+.5);
                vec3 stars=texture2D(galaxy,vec2(fract((uv.x-.08)*5.2),clamp(.45+(uv.y-.5)*5.6,0.,1.))).rgb;
                sky+=stars*.18*smoothstep(.025,.20,h)*(1.-.7*exp(-angle*8.));
                gl_FragColor=vec4(sky,1.);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }`,
    });
    const sky = new T.Mesh(new T.SphereGeometry(550, 32, 24), skyMaterial);
    // Opaque terrain writes depth first, rejecting covered sky fragments before
    // their galaxy texture and atmospheric shader need to run.
    sky.renderOrder = 1000;
    scene.add(sky);

    const frontier = makeHomeFrontier(heightAt, environment.texture);
    scene.add(frontier.root);

    const draco = new DRACOLoader();
    draco.setDecoderPath("/draco/");
    draco.setDecoderConfig({ type: "js" });
    draco.setWorkerLimit(1);
    const loader = new T.TextureLoader();
    const disposeObject = (root: T.Object3D) => {
        const geometries = new Set<T.BufferGeometry>();
        const materials = new Set<T.Material>();
        root.traverse((obj) => {
            if (!(obj instanceof T.Mesh)) return;
            if (obj instanceof T.InstancedMesh) obj.dispose();
            geometries.add(obj.geometry);
            (Array.isArray(obj.material)
                ? obj.material
                : [obj.material]
            ).forEach((material) => {
                materials.add(material);
                Object.values(material).forEach((value) => {
                    if (value instanceof T.Texture) textures.add(value);
                });
            });
        });
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((material) => material.dispose());
    };
    const disposeTextures = () => {
        const bitmaps = new Set<ImageBitmap>();
        textures.forEach((texture) => {
            const data = texture.source.data;
            if (
                typeof ImageBitmap !== "undefined" &&
                data instanceof ImageBitmap
            )
                bitmaps.add(data);
            texture.dispose();
        });
        bitmaps.forEach((bitmap) => bitmap.close());
        textures.clear();
    };
    const texture = async (path: string, color = false) => {
        const result = await loader.loadAsync(path);
        if (disposed) {
            result.dispose();
            return result;
        }
        if (color) result.colorSpace = T.SRGBColorSpace;
        result.anisotropy = Math.min(
            8,
            renderer.capabilities.getMaxAnisotropy(),
        );
        textures.add(result);
        return result;
    };
    const ready = Promise.all([
        new GLTFLoader()
            .setDRACOLoader(draco)
            .loadAsync("/models/home-rover-v1.glb")
            .then((gltf) => {
                if (disposed) {
                    disposeObject(gltf.scene);
                    disposeTextures();
                    return;
                }
                const finishes = new Map<T.Material, T.MeshStandardMaterial>();
                gltf.scene.traverse((obj) => {
                    if (obj instanceof T.Mesh) {
                        obj.castShadow = true;
                        obj.receiveShadow = true;
                        obj.userData.contactOcclusion = true;
                        const finish = (original: T.MeshStandardMaterial) => {
                            let material = finishes.get(original);
                            if (!material) {
                                // Small camera lenses need a reflected glint,
                                // not a second full-scene refraction pass.
                                material = new T.MeshStandardMaterial().copy(
                                    original,
                                );
                                material.envMap = environment.texture;
                                material.envMapIntensity = 0.55;
                                if (original.name.includes("glass")) {
                                    material.color.setHex(0x23383d);
                                    material.metalness = 0.7;
                                    material.roughness = 0.2;
                                    material.transparent = false;
                                    material.opacity = 1;
                                }
                                material.roughness = Math.max(
                                    0.24,
                                    material.roughness,
                                );
                                finishes.set(original, material);
                            }
                            return material;
                        };
                        obj.material = Array.isArray(obj.material)
                            ? obj.material.map(finish)
                            : finish(obj.material);
                    }
                });
                finishes.forEach((_replacement, original) =>
                    original.dispose(),
                );
                scene.add(gltf.scene);
            })
            .finally(() => draco.dispose()),
        texture("/images/scenes/regolith-color-v1.webp", true).then((map) => {
            if (disposed) return;
            map.wrapS = map.wrapT = T.RepeatWrapping;
            map.repeat.set(46, 46);
            groundMaterial.map = map;
            const rockColor = map.clone();
            rockColor.repeat.set(1, 1);
            textures.add(rockColor);
            rockMaterial.map = rockColor;
            rockMaterial.needsUpdate = true;
            const ridgeColor = map.clone();
            ridgeColor.repeat.set(96, 16);
            textures.add(ridgeColor);
            ridgeMaterials.forEach((material) => {
                material.map = ridgeColor;
                material.needsUpdate = true;
            });
            groundMaterial.needsUpdate = true;
        }),
        texture("/images/scenes/regolith-height-v1.webp").then((map) => {
            if (disposed) return;
            map.wrapS = map.wrapT = T.RepeatWrapping;
            map.repeat.set(46, 46);
            groundMaterial.bumpMap = map;
            groundMaterial.needsUpdate = true;
            const rockBump = map.clone();
            rockBump.repeat.set(1, 1);
            textures.add(rockBump);
            rockMaterial.bumpMap = rockBump;
            rockMaterial.bumpScale = 0.055;
            rockMaterial.needsUpdate = true;
            const ridgeBump = map.clone();
            ridgeBump.repeat.set(96, 16);
            textures.add(ridgeBump);
            ridgeMaterials.forEach((material) => {
                material.bumpMap = ridgeBump;
                material.needsUpdate = true;
            });
        }),
        texture("/images/trajectory/milky-way-v2-4k.webp", true).then((map) => {
            if (!disposed) skyMaterial.uniforms.galaxy.value = map;
        }),
    ]);
    const target = new T.Vector3();
    const views = {
        desktop: [
            {
                eye: new T.Vector3(9, 4.6, 16),
                aim: new T.Vector3(-4, 1.6, -8),
            },
            { eye: new T.Vector3(7, 8, 5), aim: new T.Vector3(-15, 3, -25) },
            { eye: new T.Vector3(3, 9, 1), aim: new T.Vector3(-15, 6.2, -26) },
        ],
        compact: [
            { eye: new T.Vector3(9, 5.8, 14), aim: new T.Vector3(0, 1.9, -9) },
            { eye: new T.Vector3(4, 8, 5), aim: new T.Vector3(-7, 2.4, -22) },
            { eye: new T.Vector3(2, 8, -3), aim: new T.Vector3(-8, 5.5, -24) },
        ],
    };
    const frame = (width: number, height: number, framing: HomeFraming) => {
        const view = homeCoverFrame(width, height, framing);
        camera.fov = framing !== "desktop" ? 36 : 33;
        camera.setViewOffset(
            view.fullWidth,
            view.fullHeight,
            view.x,
            view.y,
            view.width,
            view.height,
        );
    };
    const homePose = (framing: HomeFraming, focus: number) => {
        const stops = framing !== "desktop" ? views.compact : views.desktop;
        const from = Math.min(1, Math.floor(focus));
        const mix = focus - from;
        return {
            eye: new T.Vector3().lerpVectors(
                stops[from].eye,
                stops[from + 1].eye,
                mix,
            ),
            aim: new T.Vector3().lerpVectors(
                stops[from].aim,
                stops[from + 1].aim,
                mix,
            ),
        };
    };
    const explorationPose = (focus: number) =>
        [
            { eye: new T.Vector3(11, 5, 18), aim: new T.Vector3(2, 1.3, 0) },
            {
                eye: new T.Vector3(9, 10, -10),
                aim: new T.Vector3(-9, 2.6, -31),
            },
            { eye: new T.Vector3(2, 11, -19), aim: new T.Vector3(-10, 6, -33) },
        ][Math.round(focus)];
    const cameraFloor = (x: number, z: number) => {
        const station =
            1 -
            T.MathUtils.smoothstep(Math.hypot((x + 10) / 1.3, z + 31), 10, 20);
        const dish =
            1 - T.MathUtils.smoothstep(Math.hypot(x + 10, z + 33), 3, 7);
        const launch =
            1 - T.MathUtils.smoothstep(Math.hypot(x + 1, z + 78), 4, 10);
        let terrain = distantHeight(x, z);
        const edge = Math.min(90 - Math.abs(x), 90 - Math.abs(z + 50));
        if (edge >= 0)
            terrain = Math.max(
                terrain,
                T.MathUtils.lerp(
                    distantHeight(x, z),
                    heightAt(x, z),
                    T.MathUtils.smoothstep(edge, 0, 18),
                ),
            );
        for (let layer = 0; layer < 4; layer++) {
            if (Math.abs(x) <= 340 && Math.abs(z + 105 + layer * 65) <= 55)
                terrain = Math.max(terrain, ridgeHeight(x, z, layer));
        }
        return Math.max(
            terrain + 1.2,
            station * 6.8,
            dish * 11.5,
            launch * 11.5,
        );
    };
    const position = (
        width: number,
        height: number,
        framing: HomeFraming,
        x = 0,
        y = 0,
        focus = 0,
    ) => {
        const pose = homePose(framing, focus);
        camera.position.copy(pose.eye);
        camera.position.x += x * 0.52;
        camera.position.y += y * 0.25;
        target.copy(pose.aim);
        camera.lookAt(target);
        frame(width, height, framing);
    };
    const rendering = makeHomeRendering(renderer, scene, camera);
    return {
        scene,
        camera,
        ready,
        position,
        frame,
        homePose,
        explorationPose,
        cameraFloor,
        target,
        update: frontier.update,
        get occlusionUpdates() {
            return rendering.occlusionUpdates;
        },
        render: rendering.render,
        resize: rendering.resize,
        dispose() {
            if (disposed) return;
            disposed = true;
            rendering.dispose();
            disposeObject(scene);
            disposeTextures();
            environment.dispose();
            sun.shadow.dispose();
            draco.dispose();
        },
    };
}
