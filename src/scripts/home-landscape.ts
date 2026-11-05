import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { ImprovedNoise } from "three/addons/math/ImprovedNoise.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { homeCoverFrame, type HomeFraming } from "../lib/home-framing";
import { makeHomeFrontier } from "./home-frontier";
import { makeHomeRendering } from "./home-rendering";

// Real geometry gives the wheels, mast, foreground and horizon independent
// parallax. The camera only travels a few centimetres around this composition.
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
    scene.fog = new T.FogExp2(0x353d42, 0.003);

    const room = new RoomEnvironment();
    const pmrem = new T.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(room, 0.05, 0.1, 100, { size: 128 });
    // Reflection lighting belongs to the rover's metal. The rough landscape
    // uses direct and sky light, avoiding expensive reflection samples per pixel.
    room.dispose();
    pmrem.dispose();
    scene.add(new T.HemisphereLight(0xb9b1aa, 0x71482f, 1.15));
    const sun = new T.DirectionalLight(0xffb977, 2.3);
    sun.position.set(-16, 18, -100);
    sun.target.position.set(-4, 0, -15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
        left: -30,
        right: 30,
        top: 30,
        bottom: -30,
        near: 1,
        far: 110,
    });
    sun.shadow.bias = -0.00008;
    sun.shadow.normalBias = 0.065;
    scene.add(sun, sun.target);
    const fill = new T.DirectionalLight(0xd9b18a, 0.3);
    fill.position.set(4, 6, 10);
    scene.add(fill);

    const groundMaterial = new T.MeshStandardMaterial({
        color: 0xb08b6b,
        roughness: 0.98,
        bumpScale: 0.14,
    });
    const groundGeometry = new T.PlaneGeometry(180, 180, 220, 220);
    groundGeometry.rotateX(-Math.PI / 2);
    groundGeometry.translate(0, 0, -50);
    const vertices = groundGeometry.attributes.position;
    const colors = new Float32Array(vertices.count * 3);
    const dust = new T.Color();
    for (let i = 0; i < vertices.count; i++) {
        const x = vertices.getX(i),
            z = vertices.getZ(i);
        vertices.setY(i, heightAt(x, z));
        dust.setScalar(0.72 + noise.noise(x * 0.14, z * 0.14, 6) * 0.22);
        dust.toArray(colors, i * 3);
    }
    groundGeometry.setAttribute("color", new T.BufferAttribute(colors, 3));
    groundGeometry.computeVertexNormals();
    groundMaterial.vertexColors = true;
    const ground = new T.Mesh(groundGeometry, groundMaterial);
    ground.receiveShadow = true;
    scene.add(ground);

    // Layered, continuous ridges fade into the haze. Smooth vertex normals avoid
    // the faceted terrain and sharp joins of isolated low-poly mountain pieces.
    const ridgeMaterials: T.MeshStandardMaterial[] = [];
    for (let layer = 0; layer < 4; layer++) {
        const geometry = new T.PlaneGeometry(680, 110, 240, 60);
        geometry.rotateX(-Math.PI / 2);
        geometry.translate(0, 0, -105 - layer * 65);
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i),
                z = positions.getZ(i);
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
            const envelope = Math.exp(
                -Math.pow((z + 105 + layer * 65) / 31, 2),
            );
            positions.setY(
                i,
                -8 + envelope * Math.max(0, ridge - 0.65) * (13 + layer * 3),
            );
        }
        geometry.computeVertexNormals();
        const material = new T.MeshStandardMaterial({
            color: 0x725542,
            roughness: 1,
            bumpScale: 0.3,
        });
        ridgeMaterials.push(material);
        scene.add(new T.Mesh(geometry, material));
    }

    const rockMaterial = new T.MeshStandardMaterial({
        color: 0x685345,
        roughness: 0.95,
    });
    for (let variant = 0; variant < 4; variant++) {
        const source = new T.IcosahedronGeometry(1, 2);
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
        const rocks = new T.InstancedMesh(geometry, rockMaterial, 110);
        const pose = new T.Object3D();
        for (let i = 0; i < rocks.count; i++) {
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
            rocks.setMatrixAt(i, pose.matrix);
        }
        rocks.castShadow = true;
        rocks.receiveShadow = true;
        scene.add(rocks);
    }

    // An astronomical backdrop seen through a thin, dusty, amber horizon.
    // No giant planet intersecting the surface: the landscape is the subject.
    const skyMaterial = new T.ShaderMaterial({
        side: T.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { galaxy: { value: null as T.Texture | null } },
        vertexShader: `varying vec3 vDirection; void main() {vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `uniform sampler2D galaxy; varying vec3 vDirection;
            void main(){
                vec3 d=normalize(vDirection);
                float h=max(0.,d.y);
                vec3 sky=mix(vec3(.035,.033,.032),vec3(.005,.012,.021),smoothstep(0.,.19,h));
                vec3 sunDir=normalize(vec3(-.15,.018,-1.));
                float angle=max(0.,1.-dot(d,sunDir));
                sky+=vec3(1.,.43,.13)*(.10*exp(-angle*14.)+.18*exp(-angle*340.));
                sky+=vec3(1.,.78,.49)*2.2*exp(-angle*65000.);
                vec2 uv=vec2(atan(d.z,d.x)/6.283185+.5,asin(d.y)/3.14159+.5);
                vec3 stars=texture2D(galaxy,vec2(fract((uv.x-.08)*5.2),clamp(.45+(uv.y-.5)*5.6,0.,1.))).rgb;
                sky+=stars*.28*smoothstep(.015,.16,h);
                gl_FragColor=vec4(sky,1.);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }`,
    });
    const sky = new T.Mesh(new T.SphereGeometry(550, 32, 24), skyMaterial);
    sky.renderOrder = -1;
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
                        const finish = (original: T.MeshStandardMaterial) => {
                            let material = finishes.get(original);
                            if (!material) {
                                // Small camera lenses need a reflected glint,
                                // not a second full-scene refraction pass.
                                material = new T.MeshStandardMaterial().copy(
                                    original,
                                );
                                material.envMap = environment.texture;
                                material.envMapIntensity = 0.2;
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
    const position = (
        width: number,
        height: number,
        framing: HomeFraming,
        x = 0,
        y = 0,
        focus = 0,
    ) => {
        const view = homeCoverFrame(width, height, framing);
        const narrow = framing !== "desktop";
        camera.fov = narrow ? 36 : 33;
        const stops = narrow ? views.compact : views.desktop;
        const from = Math.min(1, Math.floor(focus));
        const mix = focus - from;
        camera.position.lerpVectors(stops[from].eye, stops[from + 1].eye, mix);
        camera.position.x += x * 0.52;
        camera.position.y += y * 0.25;
        target.lerpVectors(stops[from].aim, stops[from + 1].aim, mix);
        camera.lookAt(target);
        camera.setViewOffset(
            view.fullWidth,
            view.fullHeight,
            view.x,
            view.y,
            view.width,
            view.height,
        );
    };
    const rendering = makeHomeRendering(renderer, scene, camera);
    return {
        scene,
        camera,
        ready,
        position,
        target,
        update: frontier.update,
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
