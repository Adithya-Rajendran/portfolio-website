import type * as Three from "three";
import type { HomeFloor } from "./home-floor";
import { settlementAir, type SettlementAir } from "./settlement-air";
import { SETTLEMENT_SOIL } from "./settlement-ground";

type World = "moon" | "mars";
/** Where hardware stands: on a world, or in orbit with nothing around it. */
type Setting = World | "orbit";
type Shader = {
    vertexShader: string;
    fragmentShader: string;
    uniforms: Record<string, Three.IUniform>;
};

/**
 * What surrounds a settlement, as its hardware sees it: sunlit soil below
 * and the sky above. The Moon has no air, so only its soil fills a shadow,
 * and that is a small part of the sun: shade there is close to black. On
 * Mars the dusty sky (see settlement-air.ts) lights it as well.
 */
const SURROUNDINGS: Record<
    World,
    {
        soil: [number, number, number];
        horizon: [number, number, number];
        zenith: [number, number, number];
        dust: [number, number, number];
        pad: number;
        sinter: number;
    }
> = {
    moon: {
        soil: [0.22, 0.22, 0.226],
        horizon: [0.004, 0.004, 0.005],
        zenith: [0.002, 0.002, 0.003],
        dust: [0.3, 0.3, 0.31],
        pad: 0x55565a,
        sinter: 0xa7a5a2,
    },
    mars: {
        soil: [0.17, 0.09, 0.055],
        horizon: [0.15, 0.1, 0.068],
        zenith: [0.03, 0.026, 0.03],
        dust: [0.27, 0.15, 0.085],
        pad: 0x4a3830,
        sinter: 0xcdbfad,
    },
};

/** Nothing settles on hardware in orbit; its engines leave soot. */
const IN_ORBIT = {
    dust: [0.035, 0.032, 0.03],
    pad: 0x55565a,
    sinter: 0xa7a5a2,
} as const;

/**
 * Reflections and fill light for one world, in the settlement's own axes.
 * `sun` is where the sun stands in them.
 */
export function makeSettlementEnvironment(
    T: typeof Three,
    renderer: Three.WebGLRenderer,
    world: World,
    sun: readonly number[] = [1, 0.4, 0.2],
) {
    const around = SURROUNDINGS[world],
        air = settlementAir(world);
    const scene = new T.Scene();
    const shell = new T.Mesh(
        new T.SphereGeometry(10, 32, 16),
        new T.ShaderMaterial({
            side: T.BackSide,
            depthWrite: false,
            uniforms: {
                soil: { value: new T.Vector3(...around.soil) },
                away: {
                    value: new T.Vector3(...(air?.away ?? around.horizon)),
                },
                sunward: {
                    value: new T.Vector3(...(air?.sunward ?? around.horizon)),
                },
                halo: {
                    value: new T.Vector3(...(air?.halo ?? [0, 0, 0])),
                },
                zenith: { value: new T.Vector3(...around.zenith) },
                sun: { value: new T.Vector3().fromArray(sun).normalize() },
            },
            vertexShader: `varying vec3 vToward;
                void main() {
                    vToward = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
                }`,
            fragmentShader: `uniform vec3 soil;
                uniform vec3 away;
                uniform vec3 sunward;
                uniform vec3 halo;
                uniform vec3 zenith;
                uniform vec3 sun;
                varying vec3 vToward;
                void main() {
                    vec3 ray = normalize(vToward);
                    float bearing = dot(normalize(ray.xz + 1e-5), normalize(sun.xz));
                    vec3 horizon = mix(away, sunward, pow(clamp(bearing * .5 + .5, 0., 1.), 3.));
                    float rise = max(ray.y, 0.);
                    vec3 sky = mix(zenith, horizon, .75 * exp(-rise * 9.) + .25 * exp(-rise * 2.4))
                        + halo * .4 * exp(-max(0., 1. - dot(ray, sun)) * 9.);
                    // The ground is brightest where it is seen down-sun.
                    vec3 ground = soil * (1. - .35 * bearing);
                    gl_FragColor = vec4(mix(ground, sky, smoothstep(-.02, .02, ray.y)), 1.);
                }`,
        }),
    );
    scene.add(shell);
    const generator = new T.PMREMGenerator(renderer);
    const target = generator.fromScene(scene, 0, 0.1, 100);
    generator.dispose();
    shell.geometry.dispose();
    (shell.material as Three.Material).dispose();
    return target;
}

/** GLSL fragments a finish adds to the standard material, by stage. */
type Detail = {
    /** After the base colour is known. */
    colour?: string;
    /** After the roughness is known, before grime and wear. */
    rough?: string;
    /** After the shading normal is known. */
    relief?: string;
    /** After the emitted light is known. */
    glow?: string;
    /** Last thing before the colour is written. */
    last?: string;
};

/**
 * Built hardware carries three values at every vertex, measured when the
 * model was made: how much sky it can see, where grime settles, and which
 * edges get worn (the same scheme as the homepage's hardware). `wear` is
 * how readily a finish rubs through to bright metal; `dust` is the soil
 * that settles on it.
 *
 * A model this size cannot carry every seam, weld and print line as
 * geometry, and a surface without them reads as modelling clay. Each finish
 * therefore draws its own make-up from where a fragment is on the building:
 * `vBuilt` is that place in model metres with its height as built (the
 * hardware was lowered onto the globe afterwards), `builtPlan` lays a panel
 * grid on whichever way the face looks, and `builtPixel` is the size of one
 * pixel there, so joints fade out before they can shimmer.
 */
function surfaced(
    shader: Shader,
    wear: number,
    dust: readonly [number, number, number],
    radius: number,
    detail: Detail = {},
) {
    shader.uniforms.surfaceWear = { value: wear };
    shader.vertexShader = shader.vertexShader
        .replace(
            "#include <common>",
            `#include <common>
            attribute vec3 surface;
            varying vec3 vSurface;
            varying vec3 vBuilt;
            varying vec3 vBuiltFace;`,
        )
        .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
            vSurface = surface;
            vBuilt = ${
                radius > 0
                    ? `vec3(
                position.x,
                position.y + ${radius.toFixed(1)} - sqrt(max(1., ${(radius * radius).toFixed(1)} - dot(position.xz, position.xz))),
                position.z)`
                    : "position"
            };
            vBuiltFace = normal;`,
        );
    shader.fragmentShader = shader.fragmentShader
        .replace(
            "#include <common>",
            `#include <common>
            uniform float surfaceWear;
            uniform mat3 normalMatrix;
            varying vec3 vSurface;
            varying vec3 vBuilt;
            varying vec3 vBuiltFace;
            float builtHash(vec2 cell) {
                return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
            }
            float builtNoise(vec2 at) {
                vec2 cell = floor(at), part = fract(at);
                part = part * part * (3. - 2. * part);
                return mix(
                    mix(builtHash(cell), builtHash(cell + vec2(1., 0.)), part.x),
                    mix(builtHash(cell + vec2(0., 1.)), builtHash(cell + vec2(1.)), part.x),
                    part.y);
            }
            // Metres to the nearest joint of a grid of panels, each way.
            vec2 builtGrid(vec2 at, vec2 panel) {
                return (.5 - abs(fract(at / panel) - .5)) * panel;
            }
            // How strongly a joint of a width shows that far from it. One
            // thinner than a pixel is drawn fainter, never dropped or doubled.
            float builtJoint(float near, float width, float pixel) {
                return (1. - smoothstep(width * .5, width * .5 + pixel, near)) * clamp(width / pixel, 0., 1.);
            }`,
        )
        .replace(
            "#include <map_fragment>",
            `#include <map_fragment>
            vec3 builtFace = abs(normalize(vBuiltFace));
            float builtPixel = max(length(fwidth(vBuilt)), 1e-4);
            float builtWall = 1. - step(.7, builtFace.y);
            bool builtFlat = builtFace.y >= .7, builtSide = builtFace.x > builtFace.z;
            vec2 builtPlan = builtFlat ? vBuilt.xz : (builtSide ? vBuilt.zy : vBuilt.xy);
            vec3 builtAcross = normalize(normalMatrix * (builtFlat || !builtSide ? vec3(1., 0., 0.) : vec3(0., 0., 1.)));
            vec3 builtAlong = normalize(normalMatrix * (builtFlat ? vec3(0., 0., 1.) : vec3(0., 1., 0.)));
            ${detail.colour ?? ""}`,
        )
        .replace(
            "#include <roughnessmap_fragment>",
            `#include <roughnessmap_fragment>
            ${detail.rough ?? ""}`,
        )
        .replace(
            "#include <metalnessmap_fragment>",
            `#include <metalnessmap_fragment>
            float grime = clamp(vSurface.g, 0., 1.);
            float worn = clamp(vSurface.b, 0., 1.) * surfaceWear;
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${dust.map((value) => value.toFixed(3)).join(",")}), grime * .7);
            roughnessFactor = mix(roughnessFactor, .95, grime * .8);
            metalnessFactor *= 1. - grime * .8;
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.8, .8, .78), worn);
            metalnessFactor = mix(metalnessFactor, 1., worn);
            roughnessFactor = mix(roughnessFactor, .3, worn);`,
        )
        .replace(
            "#include <normal_fragment_maps>",
            `#include <normal_fragment_maps>
            ${detail.relief ?? ""}`,
        )
        .replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>
            ${detail.glow ?? ""}`,
        )
        .replace(
            "#include <aomap_fragment>",
            `#include <aomap_fragment>
            float skyOpen = clamp(vSurface.r, 0., 1.);
            reflectedLight.indirectDiffuse *= skyOpen;
            reflectedLight.indirectSpecular *= mix(1., skyOpen, .85);
            // The shadow map cannot resolve a crevice; lose some sun there too.
            reflectedLight.directDiffuse *= mix(1., skyOpen, .3);
            reflectedLight.directSpecular *= mix(1., skyOpen, .3);`,
        )
        .replace(
            "#include <opaque_fragment>",
            `${detail.last ?? ""}
            #include <opaque_fragment>`,
        );
}

/**
 * The finishes a settlement's model is dressed in, by the material names
 * its file carries. Unknown names are drawn as structural metal. `soil` is
 * the ground's own repeating square, for soil that has been piled up;
 * `radius` is the globe's, in model metres.
 *
 * Hardware in orbit wears the same finishes. It has no soil, no air and no
 * globe under it (`radius` 0), and what its grime channel marks is soot.
 * `rows` is how many labels its file's label sheet is divided into.
 */
export function makeSettlementFinishes(
    T: typeof Three,
    world: Setting,
    labels: readonly string[],
    anisotropy: number,
    environment: Three.Texture | undefined,
    soil?: HomeFloor,
    air?: SettlementAir,
    radius = 0,
    rows = 16,
) {
    const around = world === "orbit" ? IN_ORBIT : SURROUNDINGS[world],
        ground = world === "orbit" ? undefined : SETTLEMENT_SOIL[world];
    const number = (value: number) => value.toFixed(4);
    const triple = (value: readonly number[]) =>
        `vec3(${value.map(number).join(",")})`;
    const textures: Three.Texture[] = [];
    const painted = (
        width: number,
        height: number,
        draw: (paint: CanvasRenderingContext2D) => void,
        colour = false,
    ) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const paint = canvas.getContext("2d");
        if (paint) draw(paint);
        const texture = new T.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = T.RepeatWrapping;
        texture.anisotropy = anisotropy;
        if (colour) texture.colorSpace = T.SRGBColorSpace;
        textures.push(texture);
        return texture;
    };

    // Module designations, stencilled in the page's own monospace face.
    let drawLabels = () => {};
    const labelled = painted(
        640,
        128 * rows,
        (paint) => {
            drawLabels = () => {
                paint.clearRect(0, 0, 640, 128 * rows);
                paint.textBaseline = "middle";
                paint.font = "84px DMMono, monospace";
                labels.slice(0, rows).forEach((label, row) => {
                    paint.fillStyle = "#c98331";
                    paint.fillRect(18, row * 128 + 24, 20, 80);
                    paint.fillStyle = "#1d2428";
                    paint.fillText(label, 62, row * 128 + 68, 560);
                });
            };
            drawLabels();
        },
        true,
    );
    labelled.wrapS = labelled.wrapT = T.ClampToEdgeWrapping;
    void document.fonts
        .load("84px DMMono")
        .then(() => {
            drawLabels();
            labelled.needsUpdate = true;
        })
        .catch(() => {});
    // One module of cells: six strings of ten, bus bars between them.
    const cells = painted(
        192,
        320,
        (paint) => {
            paint.fillStyle = "#8f98a3";
            paint.fillRect(0, 0, 192, 320);
            for (let column = 0; column < 6; column++)
                for (let row = 0; row < 10; row++) {
                    const pick =
                        Math.abs(
                            Math.sin((column * 10 + row) * 12.9898) *
                                43758.5453,
                        ) % 1;
                    paint.fillStyle = `rgb(${14 + Math.floor(pick * 10)},${30 + Math.floor(pick * 16)},${84 + Math.floor(pick * 30)})`;
                    paint.fillRect(column * 32 + 1, row * 32 + 1, 30, 30);
                }
        },
        true,
    );

    const made = new Map<string, Three.MeshStandardMaterial>();
    const dressed = <M extends Three.MeshStandardMaterial>(
        material: M,
        key: string,
        wear = 0,
        detail: Detail = {},
        more?: (shader: Shader) => void,
    ) => {
        // Without its own surroundings a finish reflects the scene's.
        if (environment) material.envMap = environment;
        material.onBeforeCompile = (shader) => {
            surfaced(shader, wear, around.dust, radius, detail);
            more?.(shader);
            air?.inject(shader);
        };
        material.customProgramCacheKey = () => `settlement-${world}-${key}`;
        return material;
    };
    const flat = (
        key: string,
        color: number,
        metalness: number,
        roughness: number,
        wear = 0,
        more: Three.MeshStandardMaterialParameters = {},
        detail: Detail = {},
    ) =>
        dressed(
            new T.MeshStandardMaterial({
                color,
                metalness,
                roughness,
                envMapIntensity: 1,
                ...more,
            }),
            key,
            wear,
            detail,
        );
    // Lamps: brighter than the display's white.
    const glow = (color: number, emissive: number, emissiveIntensity: number) =>
        dressed(
            new T.MeshStandardMaterial({
                color,
                emissive,
                emissiveIntensity,
                roughness: 0.3,
                metalness: 0.1,
            }),
            "lamp",
        );

    // Plates with a joint between them and no two quite alike: `panel` is
    // one plate in metres, `joint` the gap, `tone` and `sheen` how far a
    // plate may differ in colour and in polish.
    const plated = (
        panel: [number, number],
        joint: number,
        tone: number,
        sheen: number,
        seed: number,
        extra = "",
    ): Detail => ({
        colour: `vec2 plateSize = vec2(${number(panel[0])}, ${number(panel[1])});
            vec2 plateAt = builtGrid(builtPlan, plateSize);
            float plateShow = clamp(${number(Math.min(...panel) * 0.35)} / builtPixel, 0., 1.);
            float plateJoint = max(
                builtJoint(plateAt.x, ${number(joint)}, builtPixel),
                builtJoint(plateAt.y, ${number(joint)}, builtPixel));
            float plate = builtHash(floor(builtPlan / plateSize) + ${number(seed)});
            diffuseColor.rgb *= mix(1., 1. + (plate - .55) * ${number(tone)}, plateShow) * (1. - .55 * plateJoint);
            ${extra}`,
        rough: `roughnessFactor = clamp(roughnessFactor + (plate - .5) * ${number(sheen)} * plateShow + plateJoint * .3, .06, 1.);`,
    });

    // The launch track's drive coils. Every band carries how far along the
    // track it stands (its first texture coordinate, 0 at the hall and 1 at
    // the muzzle); the site says where the sled is, how charged the line is
    // and what the time is, and the bands light to suit.
    const drive = { coil: { value: new T.Vector4(-1, 0, 0, 0) } };
    const coil = () =>
        dressed(
            new T.MeshStandardMaterial({
                color: 0x1a2630,
                emissive: 0xffffff,
                roughness: 0.3,
                metalness: 0.2,
            }),
            "coil",
            0,
            {
                glow: `// x: where the sled is; y: charge; z: braking; w: seconds.
                    float ahead = vAlong - coilDrive.x;
                    float firing = step(0., coilDrive.x);
                    // The coil the sled is in, the ones still warm behind
                    // it, and the ones switching on just ahead.
                    float pulse = exp(-pow(ahead / .03, 2.));
                    float wake = ahead < 0. ? exp(ahead / .16) : exp(-ahead / .05);
                    float idle = .1 + .05 * sin(coilDrive.w * 1.7 - vAlong * 46.);
                    float charge = coilDrive.y * (.5 + .5 * sin(coilDrive.w * 9. - vAlong * 30.)) * .5;
                    float lit = idle + charge + firing * (5. * pulse + 1.3 * wake);
                    vec3 cold = vec3(.34, .72, 1.);
                    vec3 hot = vec3(.82, .93, 1.);
                    // The last coils catch the sled: they flare warm.
                    float catching = coilDrive.z * smoothstep(.84, .9, vAlong);
                    totalEmissiveRadiance = mix(cold, hot, clamp(firing * pulse + .25 * coilDrive.y, 0., 1.)) * lit
                        + vec3(1., .55, .22) * catching * 3.;`,
            },
            (shader) => {
                shader.uniforms.coilDrive = drive.coil;
                shader.vertexShader = shader.vertexShader
                    .replace(
                        "#include <common>",
                        `#include <common>
                        varying float vAlong;`,
                    )
                    .replace(
                        "#include <begin_vertex>",
                        `#include <begin_vertex>
                        vAlong = uv.x;`,
                    );
                shader.fragmentShader = shader.fragmentShader.replace(
                    "#include <common>",
                    `#include <common>
                    uniform vec4 coilDrive;
                    varying float vAlong;`,
                );
            },
        );
    // Lit windows. No two rooms are lit alike: each few metres of a
    // building has its own lamp, brighter or dimmer, warmer or whiter, some
    // rooms are dark, every storey is brightest under its ceiling, and the
    // glazing is held in frames.
    const rooms = (emissiveIntensity: number) =>
        dressed(
            new T.MeshStandardMaterial({
                color: 0xe0bc78,
                emissive: 0xd9a05a,
                emissiveIntensity,
                roughness: 0.3,
                metalness: 0.1,
            }),
            "rooms",
            0,
            {
                colour: `vec2 paneAt = builtGrid(builtPlan, vec2(1.15, 3.4));
                    float mullion = max(
                        builtJoint(paneAt.x, .09, builtPixel),
                        builtJoint(paneAt.y, .55, builtPixel)) * builtWall;
                    diffuseColor.rgb *= 1. - .8 * mullion;`,
                glow: `vec3 roomAt = floor(vBuilt / vec3(2.7, 3.4, 2.7));
                    float room = fract(sin(dot(roomAt, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
                    float lamp = mix(.35, 1.35, room) * step(.14, room) * mix(.78, 1.16, fract(vBuilt.y / 3.4));
                    totalEmissiveRadiance *= (.04 + lamp) * (1. - .92 * mullion)
                        * mix(vec3(1., .8, .56), vec3(1., .96, .88), fract(room * 7.31));`,
            },
        );
    // What grows under glass: rows of crop and stands of cane, never one
    // green, and never a solid lump: light shows between the leaves.
    const leaves = () => {
        const material = dressed(
            new T.MeshStandardMaterial({
                color: 0x3a6a2c,
                emissive: 0x1f4a17,
                emissiveIntensity: 0.1,
                roughness: 0.8,
                metalness: 0,
                side: T.DoubleSide,
                alphaTest: 0.5,
            }),
            "leaves",
            0,
            {
                colour: `float clump = builtNoise(vBuilt.xz * 1.3 + vBuilt.y * .7);
                    float leaf = builtNoise(vBuilt.xz * 6.1 + vBuilt.y * 3.3) * .6 + builtNoise(vBuilt.zy * 13. + vBuilt.x * 2.1) * .4;
                    diffuseColor.rgb *= mix(vec3(.45, .62, .4), vec3(1.3, 1.22, .7), clump * .6 + leaf * .4);
                    // Between the leaves there is nothing, once near enough to tell.
                    diffuseColor.a = mix(1., smoothstep(.3, .42, leaf), clamp(.09 / builtPixel, 0., 1.));
                    // The underside of a leaf, seen against the light.
                    if (!gl_FrontFacing) diffuseColor.rgb *= vec3(.55, .75, .4);`,
            },
        );
        material.alphaToCoverage = true;
        return material;
    };
    // Soil that has been piled: the ground's own square, laid from above,
    // and its own unevenness at every scale, so a berm is ground and not a
    // moulded shape.
    const piled = () => {
        // Only a settlement has soil to pile.
        const land = ground,
            floor = soil;
        if (!land || !floor) return makers.frame();
        return dressed(
            new T.MeshStandardMaterial({
                color: 0xffffff,
                roughness: 0.97,
                metalness: 0,
            }),
            "piled",
            0,
            {
                colour: `vec2 soilTurned = vec2(
                        ${number(Math.cos(land.turn))} * vBuilt.x + ${number(Math.sin(land.turn))} * vBuilt.z,
                        ${number(-Math.sin(land.turn))} * vBuilt.x + ${number(Math.cos(land.turn))} * vBuilt.z);
                    vec2 soilUv = soilTurned / ${number(land.metres)};
                    vec3 soilGrain = texture2D(soilColour, soilUv).rgb / ${triple(land.mean)};
                    vec4 soilRelief = texture2D(soilShape, soilUv);
                    // The square was made for level ground: it is laid only
                    // where a pile is near level, and seen near.
                    float soilShow = clamp(${number(land.metres * 0.005)} / builtPixel, 0., 1.) * smoothstep(.8, .97, builtFace.y);
                    float soilCloud = builtNoise(vBuilt.xz * .21) * .55 + builtNoise(vBuilt.xz * .9 + 40.) * .3 + builtNoise(vBuilt.xz * 3.7 + 9.) * .15;
                    diffuseColor.rgb = ${triple(land.tint)} * mix(vec3(1.), soilGrain, soilShow) * mix(.86, 1.14, soilCloud);`,
                relief: `vec2 soilSlope = (soilRelief.rg - .502) * ${number(2.008 * land.steepest * 0.55)} * soilShow
                        + (vec2(builtNoise(vBuilt.xz * 1.9 + 3.), builtNoise(vBuilt.xz * 1.9 + 71.)) - .5) * .5
                        + (vec2(builtNoise(vBuilt.xz * 7.3 + 13.), builtNoise(vBuilt.xz * 7.3 + 57.)) - .5) * .35 * clamp(.25 / builtPixel, 0., 1.);
                    normal = normalize(normal
                        - soilSlope.x * normalize(normalMatrix * vec3(1., 0., 0.))
                        - soilSlope.y * normalize(normalMatrix * vec3(0., 0., 1.)));`,
            },
            (shader) => {
                shader.uniforms.soilShape = { value: floor.relief };
                shader.uniforms.soilColour = { value: floor.colour };
                shader.fragmentShader = shader.fragmentShader.replace(
                    "#include <common>",
                    `#include <common>
                    uniform sampler2D soilShape;
                    uniform sampler2D soilColour;`,
                );
            },
        );
    };
    const dustColour = triple(around.dust);
    const makers: Record<string, () => Three.MeshStandardMaterial> = {
        coil,
        // Welded stainless: rings a plate high, each plate rolled a little
        // differently, straw-coloured where the welding heat reached.
        steel: () =>
            flat(
                "steel",
                0xa4a9ae,
                1,
                0.34,
                0.45,
                { envMapIntensity: 1.5 },
                plated(
                    [3.7, 1.85],
                    0.04,
                    0.34,
                    0.3,
                    7,
                    `float brushed = builtNoise(vec2(builtPlan.x * .9, builtPlan.y * 11.));
                    diffuseColor.rgb *= mix(vec3(1.), vec3(1.07, .98, .84), smoothstep(.2, 0., plateAt.y) * plateShow * .55)
                        * (1. + (brushed - .5) * .1 * plateShow);`,
                ),
            ),
        // Painted panels, bolted on: a joint round each, dust drawn down them.
        paint: () =>
            flat(
                "paint",
                0xdcd9cf,
                0,
                0.5,
                0.7,
                {},
                plated(
                    [1.6, 2.4],
                    0.03,
                    0.2,
                    0.24,
                    0,
                    `float streak = builtNoise(vec2(builtPlan.x * 2.3, builtPlan.y * .22));
                    diffuseColor.rgb = mix(diffuseColor.rgb, ${dustColour} * 1.6, (1. - streak) * .16 * builtWall);`,
                ),
            ),
        frame: () =>
            flat("plain", 0x5b6066, 1, 0.5, 0.5, { envMapIntensity: 1.4 }),
        anodized: () => flat("plain", 0x1c1f23, 0.8, 0.45, 0.6),
        black: () => flat("plain", 0x0c0c0d, 0, 0.8, 0.15),
        signal: () => flat("plain", 0xc56f1d, 0.3, 0.5, 0.6),
        // Quilted cloth over insulation.
        fabric: () =>
            flat(
                "fabric",
                0xcfcabd,
                0,
                0.9,
                0,
                {},
                {
                    ...plated([0.55, 0.55], 0.03, 0.12, 0.08, 23),
                    relief: `vec2 pillow = (fract(builtPlan / .55) - .5) * plateShow;
                    normal = normalize(normal + builtAcross * pillow.x * .5 + builtAlong * pillow.y * .5);`,
                },
            ),
        // Foil blankets are never flat: every crease throws the sun elsewhere.
        foil: () =>
            flat(
                "foil",
                0xc9a04e,
                1,
                0.36,
                0,
                { envMapIntensity: 1.6 },
                {
                    ...plated([0.7, 0.7], 0.02, 0.22, 0.2, 31),
                    relief: `float creased = clamp(.07 / builtPixel, 0., 1.);
                    vec2 crease = vec2(builtNoise(builtPlan * 8.) - .5, builtNoise(builtPlan * 8. + 31.) - .5)
                        + .6 * vec2(builtNoise(builtPlan * 21.) - .5, builtNoise(builtPlan * 21. + 17.) - .5);
                    normal = normalize(normal + (builtAcross * crease.x + builtAlong * crease.y) * 1.1 * creased);`,
                },
            ),
        copper: () => flat("plain", 0xb87245, 1, 0.4, 0.3),
        solar: () =>
            flat("plain", 0xffffff, 0.55, 0.22, 0, {
                map: cells,
                envMapIntensity: 1.5,
            }),
        pane: () =>
            flat("plain", 0x0d1317, 0.9, 0.1, 0, { envMapIntensity: 1.6 }),
        // Glass shows what is behind it face on and the sky at a glance.
        glass: () =>
            flat(
                "glass",
                0x8fb2b8,
                0.05,
                0.08,
                0,
                {
                    transparent: true,
                    opacity: 0.16,
                    depthWrite: false,
                    envMapIntensity: 2,
                },
                {
                    last: `diffuseColor.a = mix(diffuseColor.a, .8, pow(1. - abs(dot(normalize(normal), normalize(vViewPosition))), 3.));`,
                },
            ),
        lit: () => rooms(2.1),
        dim: () => rooms(0.75),
        work: () => glow(0xdfe6f2, 0xcfdcf2, 2.2),
        amber: () => glow(0xe0a050, 0xe08a2c, 2.3),
        beacon: () => glow(0xd65a30, 0xe2441c, 2.6),
        guide: () => glow(0x9fd4f2, 0x73ccff, 2.3),
        grow: () => glow(0xf3d2dc, 0xf0a8c4, 1.5),
        stencil: () =>
            flat("plain", 0xffffff, 0, 0.7, 0, {
                map: labelled,
                transparent: true,
                depthWrite: false,
                polygonOffset: true,
                polygonOffsetFactor: -2,
            }),
        regolith: piled,
        // Heat-shield tiles: black glass, each fired a little differently.
        shield: () =>
            flat(
                "shield",
                0x2a2b30,
                0.1,
                0.45,
                0.1,
                { envMapIntensity: 1.4 },
                {
                    colour: `vec2 tileAt = builtGrid(builtPlan, vec2(.5));
                        float tileShow = clamp(.16 / builtPixel, 0., 1.);
                        float tileGap = max(builtJoint(tileAt.x, .02, builtPixel), builtJoint(tileAt.y, .02, builtPixel));
                        float tile = builtHash(floor(builtPlan / .5) + 11.);
                        float fired = builtNoise(builtPlan * .3);
                        diffuseColor.rgb *= mix(.85 + .3 * fired, .55 + .9 * tile, tileShow);
                        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.16), tileGap * .7);`,
                    rough: `roughnessFactor = clamp(mix(.34 + .24 * fired, .24 + .5 * tile, tileShow), .06, 1.);`,
                },
            ),
        vegetation: leaves,
        // Paving, cast in slabs and stained by what has stood on it.
        pad: () =>
            flat(
                "pad",
                around.pad,
                0,
                0.85,
                0.2,
                {},
                {
                    ...plated(
                        [4, 4],
                        0.06,
                        0.2,
                        0.16,
                        41,
                        `float stain = builtNoise(builtPlan * .45) * .6 + builtNoise(builtPlan * 2.1) * .4;
                    diffuseColor.rgb *= mix(.8, 1.12, stain);`,
                    ),
                },
            ),
        marking: () =>
            flat("plain", 0xd2cba9, 0, 0.6, 0, {
                polygonOffset: true,
                polygonOffsetFactor: -1,
            }),
        // Printed stone: laid in beads a hand deep, lifted a storey at a
        // time, never one tone, and stained by the soil it stands in.
        sinter: () =>
            flat(
                "sinter",
                around.sinter,
                0,
                0.88,
                0.15,
                {},
                {
                    colour: `float bead = fract(vBuilt.y / .24);
                    float beadShow = clamp(.085 / builtPixel, 0., 1.) * builtWall;
                    vec2 liftAt = builtGrid(builtPlan, vec2(7.2, 3.4));
                    float lift = max(builtJoint(liftAt.y, .06, builtPixel), .5 * builtJoint(liftAt.x, .045, builtPixel)) * builtWall;
                    float pour = builtHash(floor(builtPlan / vec2(7.2, 3.4)) + 3.);
                    float cloudy = builtNoise(builtPlan * .33) * .6 + builtNoise(builtPlan * 1.7 + 5.) * .4;
                    float pourShow = clamp(1.2 / builtPixel, 0., 1.);
                    diffuseColor.rgb *= mix(1., mix(.9, 1.06, pour), pourShow) * mix(.88, 1.07, cloudy) * (1. - .5 * lift)
                        * mix(1., .8 + .2 * smoothstep(0., .3, bead) * (1. - smoothstep(.7, 1., bead)), beadShow);
                    float soiled = (1. - smoothstep(.1, 3.4, vBuilt.y + (cloudy - .5) * 2.)) * builtWall;
                    diffuseColor.rgb = mix(diffuseColor.rgb, ${dustColour}, soiled * .5);`,
                    rough: `roughnessFactor = clamp(roughnessFactor - (pour - .5) * .1 + lift * .08, .3, 1.);`,
                    relief: `normal = normalize(normal - normalize(normalMatrix * vec3(0., 1., 0.)) * (bead - .5) * .7 * beadShow);`,
                },
            ),
    };
    return {
        /** The finish for a material name; made once and shared. */
        finish(name: string) {
            const known = made.get(name);
            if (known) return known;
            const material = (makers[name] ?? makers.frame)();
            material.name = name;
            made.set(name, material);
            return material;
        },
        /**
         * Turns the surroundings with the settlement, which stands tilted
         * on its globe.
         */
        orient(turn: Three.Quaternion) {
            for (const material of made.values())
                material.envMapRotation.setFromQuaternion(turn);
        },
        textures,
        drive,
    };
}
