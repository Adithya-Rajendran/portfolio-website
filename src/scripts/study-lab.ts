import * as T from "three";
import { ImprovedNoise } from "three/addons/math/ImprovedNoise.js";

type LabKit = {
    mesh: (
        geometry: T.BufferGeometry,
        material: T.Material,
        position: number[],
        parent?: T.Group,
    ) => T.Mesh;
    box: (
        size: number[],
        position: number[],
        material?: T.Material,
        parent?: T.Group,
    ) => T.Mesh;
    textures: Set<T.Texture>;
    isDisposed: () => boolean;
};

/** A wraparound observation room, with a landscape that survives camera orbit. */
export function makeObservationLab({
    mesh,
    box,
    textures,
    isDisposed,
}: LabKit) {
    const graphite = new T.MeshStandardMaterial({
        color: 0x252e32,
        metalness: 0.75,
        roughness: 0.36,
    });
    const trim = new T.MeshStandardMaterial({
        color: 0x687477,
        metalness: 0.85,
        roughness: 0.3,
    });
    const light = new T.MeshStandardMaterial({
        color: 0xdfa05d,
        emissive: 0xdfa05d,
        emissiveIntensity: 1.4,
    });
    const panel = new T.MeshStandardMaterial({
        color: 0x283538,
        metalness: 0.48,
        roughness: 0.5,
    });
    const floorCanvas = document.createElement("canvas");
    floorCanvas.width = floorCanvas.height = 512;
    const floorContext = floorCanvas.getContext("2d")!;
    floorContext.fillStyle = "#66716f";
    floorContext.fillRect(0, 0, 512, 512);
    floorContext.strokeStyle = "#525e5e";
    floorContext.lineWidth = 1.5;
    floorContext.strokeRect(2, 2, 508, 508);
    for (const x of [10, 502])
        for (const y of [10, 502]) {
            floorContext.fillStyle = "#434e4e";
            floorContext.fillRect(x - 1, y - 1, 2, 2);
        }
    const floorMap = new T.CanvasTexture(floorCanvas);
    floorMap.colorSpace = T.SRGBColorSpace;
    floorMap.wrapS = floorMap.wrapT = T.RepeatWrapping;
    floorMap.repeat.set(0.4, 0.4);
    floorMap.anisotropy = 4;
    textures.add(floorMap);
    const floor = new T.MeshStandardMaterial({
        color: 0x1b282b,
        map: floorMap,
        metalness: 0.36,
        roughness: 0.58,
        envMapIntensity: 0.18,
    });
    const floorOutline = new T.Shape();
    for (let i = 0; i <= 96; i++) {
        const angle = -Math.PI / 2 + (i / 96) * Math.PI;
        const x = Math.sin(angle) * 10.1,
            y = Math.cos(angle) * 10.1;
        if (i === 0) floorOutline.moveTo(x, y);
        else floorOutline.lineTo(x, y);
    }
    floorOutline.lineTo(14, -22);
    floorOutline.lineTo(-14, -22);
    floorOutline.closePath();
    // Only the top can be seen from the permitted camera range. No underside
    // tessellation or foundation detail is needed inside this observation room.
    const floorGeometry = new T.ShapeGeometry(floorOutline);
    floorGeometry.rotateX(-Math.PI / 2);
    mesh(floorGeometry, floor, [0, -2.28, 0]);

    const arc = (
        radius: number,
        height: number,
        thickness: number,
        mat: T.Material,
    ) => {
        const points = Array.from({ length: 81 }, (_, i) => {
            const angle = -1.4 + (i / 80) * 2.8;
            return new T.Vector3(
                Math.sin(angle) * radius,
                height,
                -Math.cos(angle) * radius,
            );
        });
        return mesh(
            new T.TubeGeometry(
                new T.CatmullRomCurve3(points),
                128,
                thickness,
                12,
                false,
            ),
            mat,
            [0, 0, 0],
        );
    };
    // Keep every support behind the inspection area. The widest orbit and
    // dolly must not move the camera outside a forward-curving window frame.
    arc(10.2, -1.85, 0.18, graphite);
    arc(10.15, -1.64, 0.045, trim);
    arc(10.07, -1.71, 0.018, light);
    arc(10.4, -2.1, 0.1, graphite);
    arc(8.6, 4.9, 0.28, graphite);
    arc(8.44, 4.66, 0.045, trim);
    for (const angle of [-1.27, -0.74, 0.74, 1.27]) {
        const point = (radius: number, y: number) =>
            new T.Vector3(
                Math.sin(angle) * radius,
                y,
                -Math.cos(angle) * radius,
            );
        const path = new T.CatmullRomCurve3([
            point(10.2, -2.25),
            point(10.2, 0),
            point(10.1, 1.9),
            point(9.65, 3.6),
            point(8.6, 4.9),
        ]);
        mesh(
            new T.TubeGeometry(path, 72, 0.22, 16, false),
            graphite,
            [0, 0, 0],
        );
        const inner = new T.CatmullRomCurve3([
            point(9.99, -1.5),
            point(9.99, 0),
            point(9.89, 1.9),
            point(9.44, 3.6),
            point(8.39, 4.9),
        ]);
        mesh(new T.TubeGeometry(inner, 72, 0.035, 12, false), trim, [0, 0, 0]);
        for (const y of [-0.9, 3.4]) {
            const inset = box(
                [0.055, 0.5, 0.06],
                point(9.94, y).toArray(),
                light,
            );
            inset.rotation.y = -angle;
        }
    }
    // Subtle floor tracks connect the circular calibration bench to the room.
    for (const radius of [3.35, 3.42, 5.2]) {
        const track = mesh(
            new T.TorusGeometry(radius, 0.012, 8, 128),
            trim,
            [0, -2.267, 0],
        );
        track.rotation.x = Math.PI / 2;
    }
    for (const side of [-1, 1]) {
        const x = side * 5.9;
        box([1.75, 0.65, 1.25], [x, -1.98, -4.8], graphite);
        const consoleTop = box([1.85, 0.09, 1.32], [x, -1.61, -4.8], panel);
        consoleTop.rotation.x = 0.12;
        box([1.45, 0.035, 0.035], [x, -1.49, -4.2], trim);
        for (let i = 0; i < 7; i++)
            box(
                [0.025, 0.13 + (i % 3) * 0.05, 0.025],
                [x - 0.55 + i * 0.12, -1.92, -4.15],
                trim,
            );
        box([0.18, 0.035, 0.035], [x + 0.55, -1.79, -4.15], light);
    }

    // A spherical sky has no rectangular edge and remains behind every allowed
    // orbit angle. The horizon is gently warm; the upper sky remains almost black.
    const skyMaterial = new T.ShaderMaterial({
        side: T.BackSide,
        depthWrite: false,
        vertexShader: `varying vec3 direction;
            void main(){direction=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `varying vec3 direction;
            float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
            void main(){
                vec3 d=normalize(direction);
                float horizon=exp(-abs(d.y+.025)*13.);
                vec3 color=mix(vec3(.006,.011,.019),vec3(.075,.065,.060),horizon);
                float glow=pow(max(0.,dot(d,normalize(vec3(-.8,.015,-1.)))),28.);
                color+=vec3(.022,.012,.005)*glow;
                vec2 uv=vec2(atan(d.z,d.x),asin(d.y))*vec2(340.,340.);
                vec2 cell=floor(uv);
                float star=smoothstep(.997,1.,hash(cell))*(1.-smoothstep(.02,.18,length(fract(uv)-.5)));
                color+=vec3(.24,.29,.35)*star*smoothstep(.025,.25,d.y);
                gl_FragColor=vec4(color,1.);
            }`,
    });
    const sky = mesh(new T.SphereGeometry(600, 32, 16), skyMaterial, [0, 0, 0]);
    sky.castShadow = sky.receiveShadow = false;
    sky.renderOrder = -1;

    const noise = new ImprovedNoise();
    // Spend vertices on the landscape seen through the window, not on a huge
    // uniform grid. The rear sector still exists for very wide windows and high
    // camera angles; sparse rings there avoid a hard cut at any camera limit.
    const radii = [
        0, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 53, 58, 64, 70, 77, 85,
        94, 104, 116, 130, 146, 165, 188, 215, 250, 295, 350, 420, 520,
    ];
    const angles = Array.from(
        { length: 193 },
        (_, i) => -2.55 + (i / 192) * 5.1,
    );
    for (let i = 1; i < 16; i++)
        angles.push(2.55 + (i / 16) * (Math.PI * 2 - 5.1));
    const vertices: number[] = [],
        indices: number[] = [];
    for (const radius of radii)
        for (const angle of angles)
            vertices.push(
                Math.sin(angle) * radius,
                0,
                -Math.cos(angle) * radius,
            );
    for (let ring = 0; ring < radii.length - 1; ring++)
        for (let i = 0; i < angles.length; i++) {
            const next = (i + 1) % angles.length;
            const a = ring * angles.length + i,
                b = ring * angles.length + next;
            const c = a + angles.length,
                d = b + angles.length;
            indices.push(a, b, c, b, d, c);
        }
    const terrain = new T.BufferGeometry();
    terrain.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
    terrain.setIndex(indices);
    const positions = terrain.getAttribute("position");
    const uvs: number[] = [];
    const colors: number[] = [];
    const nearColor = new T.Color(0xb79c87);
    const farColor = new T.Color(0x696b72);
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i),
            z = positions.getZ(i);
        const distance = Math.hypot(x, z);
        uvs.push(x / 680 + 0.5, z / 680 + 0.5);
        const beyondRoom = T.MathUtils.smoothstep(distance, 23, 65);
        const broad = noise.noise(x * 0.013, z * 0.013, 3.7);
        const plateau = T.MathUtils.smoothstep(broad, 0.02, 0.48);
        const basin = Math.exp(
            -Math.pow((x - 12) / 60, 2) - Math.pow((z + 75) / 90, 2),
        );
        const erosion = noise.noise(x * 0.035, z * 0.035, 9) * 1.2;
        const ripples = noise.noise(x * 0.13, z * 0.13, 7) * 0.12;
        // Two broad, irregular ridge belts keep the skyline layered. Rounded
        // noise avoids sharp creases; a quiet basin separates the near foothills.
        const nearRidge =
            Math.exp(-Math.pow((distance - 75) / 27, 2)) *
            (3 + noise.noise(x * 0.028, z * 0.028, 31) * 6);
        const distantRidge =
            Math.exp(-Math.pow((distance - 210) / 58, 2)) *
            (10 +
                noise.noise(x * 0.022, z * 0.022, 19) * 14 +
                noise.noise(x * 0.061, z * 0.061, 23) * 2);
        const relief =
            (plateau * 5 + nearRidge + erosion) * (1 - basin * 0.8) +
            distantRidge;
        positions.setY(i, -5.1 + beyondRoom * relief + ripples);
        const color = nearColor
            .clone()
            .lerp(farColor, T.MathUtils.smoothstep(distance, 65, 240) * 0.65);
        color.multiplyScalar(0.78 + noise.noise(x * 0.08, z * 0.08, 17) * 0.08);
        colors.push(color.r, color.g, color.b);
    }
    terrain.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    terrain.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
    terrain.computeVertexNormals();
    const dust = new T.MeshStandardMaterial({
        color: 0xd3bba7,
        roughness: 1,
        bumpScale: 0.045,
        envMapIntensity: 0.12,
        vertexColors: true,
    });
    const landscapeBlend = { value: 0 };
    // Far rock detail should resolve into colour, not a repetitive carpet. Fade
    // high-frequency albedo with distance while retaining the actual silhouette.
    dust.onBeforeCompile = (shader) => {
        shader.uniforms.landscapeBlend = landscapeBlend;
        shader.vertexShader = shader.vertexShader
            .replace(
                "#include <common>",
                "#include <common>\nvarying float landscapeDistance;",
            )
            .replace(
                "#include <begin_vertex>",
                "#include <begin_vertex>\nlandscapeDistance=length(position.xz);",
            );
        shader.fragmentShader = shader.fragmentShader
            .replace(
                "#include <common>",
                "#include <common>\nvarying float landscapeDistance;uniform float landscapeBlend;",
            )
            .replace(
                "#include <map_fragment>",
                `
                #ifdef USE_MAP
                    vec4 rock = texture2D(map, vMapUv);
                    float detail = mix(.72,.16,smoothstep(25.,150.,landscapeDistance));
                    diffuseColor *= mix(vec4(.55,.49,.42,1.),rock,detail);
                #endif
                diffuseColor.a *= 1.-landscapeBlend*smoothstep(18.,55.,landscapeDistance);
            `,
            );
    };
    dust.customProgramCacheKey = () => "observation-landscape-1";
    const ground = mesh(terrain, dust, [0, 0, 0]);
    ground.castShadow = false;
    let panoramaExpired = false;
    let panoramaTimer: ReturnType<typeof setTimeout>;
    const panoramaLoad = (async () => {
        try {
            const map = await new T.TextureLoader().loadAsync(
                matchMedia("(max-width: 800px)").matches
                    ? "/images/scenes/mars-lab-panorama-v1.webp"
                    : "/images/scenes/mars-lab-panorama-8k-v1.webp",
            );
            if (isDisposed() || panoramaExpired) {
                map.dispose();
                return;
            }
            map.colorSpace = T.SRGBColorSpace;
            map.wrapS = T.RepeatWrapping;
            map.anisotropy = 8;
            textures.add(map);
            // The photographic ridge is hundreds of scene units away. Its
            // stable parallax supplies detail without tessellating unseen rock.
            const geometry = new T.PlaneGeometry(1, 1, 192, 16);
            const points = geometry.getAttribute("position");
            const uv = geometry.getAttribute("uv");
            for (let i = 0; i < points.count; i++) {
                const u = uv.getX(i),
                    v = uv.getY(i);
                const angle = (u - 0.58) * Math.PI * 2;
                const elevation =
                    (340 - (1 - v) * 500) * ((Math.PI * 2) / 4096) * 0.45;
                points.setXYZ(
                    i,
                    Math.sin(angle) * 450,
                    Math.tan(elevation) * 450 - 2,
                    -Math.cos(angle) * 450,
                );
            }
            geometry.computeVertexNormals();
            const material = new T.MeshBasicMaterial({
                map,
                color: 0xbac6d3,
                transparent: true,
                depthWrite: false,
                side: T.DoubleSide,
                fog: false,
            });
            const ridge = mesh(geometry, material, [0, 0, 0]);
            ridge.castShadow = ridge.receiveShadow = false;
            ridge.renderOrder = 1;
            landscapeBlend.value = 1;
            dust.transparent = true;
            dust.depthWrite = false;
            dust.needsUpdate = true;
            ground.renderOrder = 2;
            // Keep genuine, smooth 3D ground near the window. Distant ground
            // stays low so it cannot obscure the detailed photographed ridges.
            for (let i = 0; i < positions.count; i++) {
                const distance = Math.hypot(
                    positions.getX(i),
                    positions.getZ(i),
                );
                positions.setY(
                    i,
                    T.MathUtils.lerp(
                        positions.getY(i),
                        -5.1,
                        T.MathUtils.smoothstep(distance, 40, 80),
                    ),
                );
            }
            positions.needsUpdate = true;
            terrain.computeVertexNormals();
            terrain.computeBoundingSphere();
        } catch {
            /* The complete procedural landscape remains as a fallback. */
        }
    })();
    // Optional photographic detail must not keep the robot waiting forever on
    // a stalled connection. Late images are disposed without changing the view.
    const panoramaReady = Promise.race([
        panoramaLoad,
        new Promise<void>((resolve) => {
            panoramaTimer = setTimeout(() => {
                panoramaExpired = true;
                resolve();
            }, 10000);
        }),
    ]).finally(() => clearTimeout(panoramaTimer));
    return Promise.all([
        panoramaReady,
        Promise.all(
            (
                [
                    ["regolith-color-v1.webp", true],
                    ["regolith-height-v1.webp", false],
                ] as const
            ).map(async ([file, color]) => {
                try {
                    const map = await new T.TextureLoader().loadAsync(
                        `/images/scenes/${file}`,
                    );
                    if (isDisposed()) {
                        map.dispose();
                        return;
                    }
                    if (color) map.colorSpace = T.SRGBColorSpace;
                    map.wrapS = map.wrapT = T.RepeatWrapping;
                    map.repeat.set(150, 150);
                    map.anisotropy = 4;
                    textures.add(map);
                    if (color) dust.map = map;
                    else dust.bumpMap = map;
                    dust.needsUpdate = true;
                } catch {
                    /* Optional surface detail; geometry and color remain complete. */
                }
            }),
        ),
    ]).then(() => {});
}
