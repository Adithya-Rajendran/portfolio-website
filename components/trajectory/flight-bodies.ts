import {
    AdditiveBlending,
    BackSide,
    BoxGeometry,
    BufferGeometry,
    Color,
    ConeGeometry,
    CylinderGeometry,
    DoubleSide,
    Float32BufferAttribute,
    Group,
    Mesh,
    type MeshLambertMaterial,
    type MeshPhongMaterial,
    MeshStandardMaterial,
    Points,
    ShaderChunk,
    ShaderMaterial,
    SphereGeometry,
    Vector2,
    Vector3,
    Vector4,
    type Texture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * The flight's surfaces (flight-gl.ts places them): the worlds' shading,
 * Earth's clouds and atmosphere, Saturn's ring, the sky (the Milky Way
 * and the stars), the asteroid belt and the spacecraft with its burn.
 * Everything is a pure function of the pose, with no time, noise or
 * flicker, so any progress renders the same picture.
 *
 * Two looks share one set of materials through the Plate uniforms. Void
 * (uPrint 0) lights the worlds as photographs. Flight Manual (uPrint 1)
 * prints them as a duotone plate, ink to paper by their lit tone (the
 * night side a screen of ink) with a 1px ink limb, and draws nothing
 * additive: no night lights, atmosphere or Milky Way; stars and the belt
 * as ink dots.
 */

/** The theme, shared by every surface. Colours are linear. */
export interface Plate {
    uPrint: { value: number };
    uPaper: { value: Color };
    uInk: { value: Color };
}
export const makePlate = (): Plate => ({
    uPrint: { value: 0 },
    uPaper: { value: new Color() },
    uInk: { value: new Color() },
});

/** Earth's air, linear: a clear blue, warming toward the Sun at most to
 *  a neutral warm white (never orange: orange is the accent's). */
const AIR = new Color(0.32, 0.55, 1.0);
const AIR_WARM = new Color(1.0, 0.94, 0.86);

/** The most worlds whose discs the lines and the belt keep clear of. */
export const MAX_DISCS = 8;

/* ---- the globes ------------------------------------------------------------ */

export interface RingShadow {
    map: { value: Texture | null };
    centre: { value: Vector3 };
    pole: { value: Vector3 };
    /** The ring's inner and outer radius, scene units as drawn. */
    radii: { value: [number, number] };
}

export interface GlobeLook {
    /** Wrap lighting: how far past the terminator the light reaches. */
    wrap: number;
    /** A soft terminator: the light comes in gradually over this much of
     *  its range rather than from a hard edge (a thin air's dusk). */
    soft?: number;
    /** Flight Manual: the lit tone's gain before the ink-to-paper curve. */
    print: number;
    /** Earth: city lights on the night side only, and haze at the limb. */
    earth?: boolean;
    /** Earth: a box on the stage its night lights keep off, fading out
     *  over twice `soft` (device pixels): the figure's caption, which the
     *  sunrise's night side lies under. */
    keep?: { box: { value: Vector4 }; soft: { value: number } };
    /** A faint limb darkening and a thin rim on the day side (Void). */
    limb?: { dark: number; rim: Color };
    /** Saturn: the ring's shadow on the globe. */
    ring?: RingShadow;
    /** Flight Manual's 1px ink limb (a globe, not its cloud shell). */
    outline?: boolean;
    /** The Moon's dust: lit as regolith (Lommel–Seeliger), whose limb
     *  stays bright, so a crescent shines rather than fades. */
    lunar?: boolean;
    /** A shell over a globe (Earth's clouds): on paper it thins out
     *  toward the limb, leaving the globe's ink limb clean. */
    shell?: boolean;
}

const DOT_NL =
    "float dotNL = saturate( dot( geometryNormal, directLight.direction ) );";
/** Wrap lighting (or the Moon's regolith, scaled to match at full). */
const WRAPPED_DOT_NL = /* glsl */ `
#ifdef GLOBE_LUNAR
float mu0 = saturate( dot( geometryNormal, directLight.direction ) );
float dotNL = 2.0 * mu0 / ( mu0 + saturate( dot( geometryNormal, geometryViewDir ) ) + 1e-3 );
#else
float dotNL = saturate( ( dot( geometryNormal, directLight.direction ) + uWrap ) / ( 1.0 + uWrap ) );
if ( uSoft > 0.0 ) dotNL *= smoothstep( 0.0, uSoft, dotNL );
#endif`;
const GLOBE_PARS = /* glsl */ `
uniform float uWrap;
uniform float uSoft;
uniform float uPrint;
uniform float uPrintGain;
uniform vec3 uPaper;
uniform vec3 uInk;
varying vec3 vGlobeP;
varying vec3 vGlobeN;
#ifdef GLOBE_EARTH
uniform vec3 uAir;
uniform vec4 uKeep;
uniform float uKeepSoft;
#endif
#ifdef GLOBE_LIMB
uniform float uLimbDark;
uniform vec3 uRim;
#endif
#ifdef GLOBE_RING
uniform sampler2D uRingMap;
uniform vec3 uRingC;
uniform vec3 uRingN;
uniform vec2 uRingR;
#endif
`;
/** City lights only where the Sun has set (the Sun is at the origin);
 *  on paper neither they nor the Moon's earthshine print. */
const GLOBE_NIGHT = /* glsl */ `
#ifdef GLOBE_EARTH
totalEmissiveRadiance *= (1.0 - smoothstep(-0.12, 0.12,
    dot(normalize(vGlobeN), normalize(-vGlobeP)))) * (1.0 - uPrint);
{
    vec2 kept = max(uKeep.xy - gl_FragCoord.xy, gl_FragCoord.xy - uKeep.zw);
    totalEmissiveRadiance *= smoothstep(0.0, 2.0 * uKeepSoft,
        max(kept.x, kept.y));
}
#endif
#ifdef GLOBE_LUNAR
totalEmissiveRadiance *= 1.0 - uPrint;
#endif
`;
/** The ring's shadow: where the ray toward the Sun crosses the ring. */
const GLOBE_RING = /* glsl */ `
#ifdef GLOBE_RING
{
    vec3 L = normalize(-vGlobeP);
    float dn = dot(L, uRingN);
    float t = dot(uRingC - vGlobeP, uRingN) / (abs(dn) > 1e-4 ? dn : 1e-4);
    float u = (length(vGlobeP + t * L - uRingC) - uRingR.x) / (uRingR.y - uRingR.x);
    float a = texture2D(uRingMap, vec2(clamp(u, 0.0, 1.0), 0.5)).a;
    if (t > 0.0 && u > 0.0 && u < 1.0)
        reflectedLight.directDiffuse *= 1.0 - 0.92 * a;
}
#endif
`;
const GLOBE_FINISH = /* glsl */ `
{
    vec3 N = normalize(vGlobeN);
    float nv = dot(N, normalize(cameraPosition - vGlobeP));
    float nl = dot(N, normalize(-vGlobeP));
    float edge = 1.0 - max(nv, 0.0);
    float glow = 1.0 - uPrint;
#ifdef GLOBE_EARTH
    outgoingLight = mix(outgoingLight, uAir * (0.35 + 0.65 * max(nl, 0.0)),
        0.55 * pow(edge, 2.2) * smoothstep(-0.15, 0.3, nl) * glow);
#endif
#ifdef GLOBE_LIMB
    outgoingLight *= 1.0 - uLimbDark * edge * edge * glow;
    outgoingLight += uRim * pow(edge, 5.0) * smoothstep(0.0, 0.4, nl) * glow;
#endif
    if (uPrint > 0.5) {
        // Ink to paper by the tone: mostly the light on the surface (its
        // shape), partly the surface's own shade (its detail); the night
        // side a screen of ink, never solid.
        vec3 luma = vec3(0.2126, 0.7152, 0.0722);
        float lum = dot(outgoingLight, luma) * uPrintGain;
        float light = dot(outgoingLight / max(diffuseColor.rgb, vec3(0.02)), luma);
        float tone = clamp(pow(mix(lum, light, 0.35), 0.7), 0.0, 1.0);
#ifdef GLOBE_LUNAR
        // The Moon prints its phase, a little fuller than it is so that
        // its crescent reads at the plate's size: paper where it is lit,
        // a screen of ink across its night side.
        tone = mix(min(tone, 0.22), 1.0, smoothstep(-0.42, -0.22, nl));
#endif
        outgoingLight = mix(uInk, uPaper, 0.28 + 0.72 * tone);
#ifdef GLOBE_SHELL
        diffuseColor.a *= smoothstep(0.1, 0.3, nv);
#endif
#ifdef GLOBE_OUTLINE
        float w = fwidth(nv);
        outgoingLight = mix(outgoingLight, uInk,
            1.0 - smoothstep(0.6 * w, 1.8 * w, nv));
#endif
    }
}
`;

/**
 * A world's Lambert or Phong material with the flight's shading: wrap
 * lighting for a soft terminator, and the look's extras. Each variant
 * gets its own program (customProgramCacheKey), since they share
 * onBeforeCompile's source.
 */
export function shadeGlobe(
    material: MeshLambertMaterial | MeshPhongMaterial,
    plate: Plate,
    look: GlobeLook,
) {
    const flags = {
        GLOBE_EARTH: !!look.earth,
        GLOBE_LIMB: !!look.limb,
        GLOBE_RING: !!look.ring,
        GLOBE_OUTLINE: !!look.outline,
        GLOBE_LUNAR: !!look.lunar,
        GLOBE_SHELL: !!look.shell,
    };
    const defines = Object.entries(flags)
        .filter(([, on]) => on)
        .map(([name]) => name);
    material.defines = Object.fromEntries(defines.map((d) => [d, ""]));
    const uniforms = {
        ...plate,
        uWrap: { value: look.wrap },
        uSoft: { value: look.soft ?? 0 },
        uPrintGain: { value: look.print },
        uAir: { value: AIR },
        uKeep: look.keep?.box ?? { value: new Vector4(-1e4, -1e4, -9e3, -9e3) },
        uKeepSoft: look.keep?.soft ?? { value: 1 },
        uLimbDark: { value: look.limb?.dark ?? 0 },
        uRim: { value: look.limb?.rim ?? new Color() },
        uRingMap: look.ring?.map ?? { value: null },
        uRingC: look.ring?.centre ?? { value: new Vector3() },
        uRingN: look.ring?.pole ?? { value: new Vector3() },
        uRingR: look.ring?.radii ?? { value: [0, 1] },
    };
    const pars =
        material.type === "MeshPhongMaterial"
            ? "lights_phong_pars_fragment"
            : "lights_lambert_pars_fragment";
    material.customProgramCacheKey = () =>
        `globe:${material.type}:${defines.join(",")}`;
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace(
                "#include <common>",
                "#include <common>\nvarying vec3 vGlobeP;\nvarying vec3 vGlobeN;",
            )
            .replace(
                "#include <worldpos_vertex>",
                `#include <worldpos_vertex>
vGlobeP = (modelMatrix * vec4(transformed, 1.0)).xyz;
vGlobeN = normalize(mat3(modelMatrix) * objectNormal);`,
            );
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>\n${GLOBE_PARS}`)
            .replace(
                `#include <${pars}>`,
                ShaderChunk[pars].replace(DOT_NL, WRAPPED_DOT_NL),
            )
            .replace(
                "#include <emissivemap_fragment>",
                `#include <emissivemap_fragment>\n${GLOBE_NIGHT}`,
            )
            .replace(
                "#include <lights_fragment_end>",
                `#include <lights_fragment_end>\n${GLOBE_RING}`,
            )
            .replace(
                "#include <opaque_fragment>",
                `${GLOBE_FINISH}\n#include <opaque_fragment>`,
            );
    };
}

/* ---- Earth's air ------------------------------------------------------------ */

/** Earth's atmosphere: a back-facing shell just outside the globe, lit on
 *  the day side and brightest toward the Sun, where it warms to a
 *  neutral white. Void only (it is additive). */
export function atmosphere(radius: number) {
    const material = new ShaderMaterial({
        side: BackSide,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
            uAir: { value: AIR },
            uWarm: { value: AIR_WARM },
            uC: { value: new Vector3() },
        },
        vertexShader: /* glsl */ `
varying vec3 vW;
varying vec3 vN;
void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
}`,
        fragmentShader: /* glsl */ `
uniform vec3 uAir;
uniform vec3 uWarm;
uniform vec3 uC;
varying vec3 vW;
varying vec3 vN;
void main() {
    vec3 V = normalize(cameraPosition - vW);
    vec3 L = normalize(-vW);
    float ndv = abs(dot(normalize(vN), V));
    float day = smoothstep(-0.2, 0.35, dot(normalize(vW - uC), L));
    float ahead = pow(max(dot(-V, L), 0.0), 10.0);
    // The day side's rim, and backlit air hugging the limb toward the
    // Sun (h: 1 at the globe's limb, 0 at the shell's edge), blue along
    // the limb and warming to white only close to the Sun.
    float h = ndv / 0.258;
    vec3 c = uAir * pow(ndv, 3.0) * 1.4 * day
        + mix(uAir, uWarm, ahead * ahead) * ahead * h * h * h * 1.6;
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`,
    });
    return {
        mesh: new Mesh(new SphereGeometry(radius * 1.035, 96, 48), material),
        centre: material.uniforms.uC.value as Vector3,
    };
}

/* ---- Saturn's ring ---------------------------------------------------------- */

/**
 * The ring, lit: its lit face at full, its unlit face by the light the
 * sparse ring lets through, and the globe's shadow across it. Flight
 * Manual prints it as a flat ink screen, darker in the globe's shadow,
 * with hairlines at the ring's edges and the Cassini division.
 */
export function ringMaterial(
    plate: Plate,
    shadow: RingShadow,
    radius: {
        value: number;
    },
) {
    return new ShaderMaterial({
        side: DoubleSide,
        transparent: true,
        depthWrite: false,
        uniforms: {
            ...plate,
            map: shadow.map,
            uC: shadow.centre,
            uN: shadow.pole,
            uR: radius,
            uTint: { value: new Color(0xd8d2c6) },
        },
        vertexShader: /* glsl */ `
varying vec2 vUv;
varying vec3 vW;
void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
}`,
        fragmentShader: /* glsl */ `
uniform sampler2D map;
uniform vec3 uC;
uniform vec3 uN;
uniform float uR;
uniform vec3 uTint;
uniform float uPrint;
uniform vec3 uInk;
varying vec2 vUv;
varying vec3 vW;
float hair(float at, float fw) {
    return 1.0 - smoothstep(0.0, 1.2 * fw, abs(vUv.x - at));
}
void main() {
    vec4 t = texture2D(map, vec2(vUv.x, 0.5));
    vec3 L = normalize(-vW);
    vec3 V = normalize(cameraPosition - vW);
    float lit = dot(uN, L) * dot(uN, V) > 0.0 ? 1.0 : 0.55 * (1.0 - t.a) + 0.05;
    vec3 oc = uC - vW;
    float along = dot(oc, L);
    float shade = along > 0.0
        ? smoothstep(uR * 0.985, uR * 1.015, length(oc - along * L)) : 1.0;
    vec4 c = vec4(uTint * t.rgb * lit * shade * 1.6, t.a);
    if (uPrint > 0.5) {
        float fw = fwidth(vUv.x);
        float e = max(max(hair(0.004, fw), hair(0.24, fw)),
            max(max(hair(0.66, fw), hair(0.72, fw)), hair(0.996, fw)));
        c = vec4(uInk, max(t.a * 0.30 * mix(2.2, 1.0, shade), e * 0.85));
    }
    gl_FragColor = c;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`,
    });
}

/* ---- the sky ---------------------------------------------------------------- */

/** The sky fades in below the stage's top edge (uFeather: that edge and
 *  the fade's height, device pixels), so it meets the page above it, or
 *  the header, without a hard edge. */
const SKY_FEATHER = "smoothstep(0.0, uFeather.y, uFeather.x - gl_FragCoord.y)";

/**
 * The Milky Way: Solar System Scope's sky, in galactic coordinates, on
 * the inside of a sphere that moves with the camera (so it has no
 * parallax), added to the page's black where no world covers it (it
 * draws after them, depth-tested). The file was brightened fourfold
 * before encoding (keeping its faint detail); here it is dimmed back and
 * floored, so the sky away from the band stays within a few levels of
 * the page's black. The file has no point stars of its own (magnified,
 * they read as soft blobs): the seeded stars in front carry the sky's
 * points. Display-referred: no colour conversion, no tone mapping. Void
 * only.
 */
export function milkyWay() {
    const geometry = new SphereGeometry(1800, 64, 32);
    // Seen from inside, unmirrored.
    geometry.scale(-1, 1, 1);
    const material = new ShaderMaterial({
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
        uniforms: {
            map: { value: null as Texture | null },
            uGain: { value: 0.3 },
            uFeather: { value: new Vector2(1, 1) },
        },
        vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
        fragmentShader: /* glsl */ `
uniform sampler2D map;
uniform float uGain;
uniform vec2 uFeather;
varying vec2 vUv;
void main() {
    vec3 c = texture2D(map, vUv).rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, 0.55);
    gl_FragColor = vec4(max(c - 0.03, 0.0) * uGain * ${SKY_FEATHER}, 1.0);
}`,
    });
    const mesh = new Mesh(geometry, material);
    // Opaque, yet added to the black: after the worlds, so the pixels
    // they cover are skipped.
    mesh.renderOrder = 10;
    mesh.frustumCulled = false;
    return { mesh, material };
}

/** A seeded random number generator (mulberry32). */
export function seeded(seed: number) {
    let a = seed | 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/** A normal deviate from two uniform ones. */
const gauss = (random: () => number) =>
    Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());

/** Point sprites sized in CSS pixels (uDpr) with soft round edges, each
 *  with its own size, tint and brightness; added to the black in Void,
 *  ink dots on paper in Flight Manual. */
const DOT_VERTEX = /* glsl */ `
attribute float size;
attribute float bright;
attribute vec3 tint;
uniform float uDpr;
uniform float uPrint;
uniform float uInkLimit;
uniform float uInkAlpha;
uniform float uLevel;
varying vec3 vTint;
varying float vA;
void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * w;
    float px = size * uDpr;
    gl_PointSize = max(px, 1.0) + 1.0;
    vTint = tint;
    vA = bright * min(1.0, px * px);
#ifdef DOT_PHASE
    // Lit by phase: brightest where the camera sees a grain's day side.
    vA *= mix(0.3, 1.0, 0.5 + 0.5 * dot(normalize(-w.xyz),
        normalize(cameraPosition - w.xyz)));
#endif
    if (uPrint > 0.5) vA = bright >= uInkLimit ? uInkAlpha : 0.0;
    vA *= uLevel;
}`;
/** DOT_SKY: the stars fade in below the stage's top (SKY_FEATHER).
 *  DOT_CLEAR: the belt's grains keep off every world's disc on screen
 *  (uDiscs: x, y, radius, device pixels, as the orbits do), so none
 *  speckles a globe it passes in front of. */
const DOT_FRAGMENT = /* glsl */ `
uniform float uPrint;
uniform vec3 uInk;
#ifdef DOT_SKY
uniform vec2 uFeather;
#endif
#ifdef DOT_CLEAR
uniform vec3 uDiscs[${MAX_DISCS}];
uniform float uDiscClear;
#endif
varying vec3 vTint;
varying float vA;
void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float a = vA * (1.0 - smoothstep(0.4, 1.0, r));
#ifdef DOT_SKY
    a *= ${SKY_FEATHER};
#endif
#ifdef DOT_CLEAR
    for (int i = 0; i < ${MAX_DISCS}; i++) {
        vec3 d = uDiscs[i];
        if (d.z > 0.0)
            a *= smoothstep(d.z, d.z + uDiscClear,
                distance(gl_FragCoord.xy, d.xy));
    }
#endif
    if (a < 0.004) discard;
    gl_FragColor = vec4(uPrint > 0.5 ? uInk : vTint, a);
}`;

function dots(
    positions: number[],
    size: number[],
    bright: number[],
    tint: number[],
    plate: Plate,
    kind: "sky" | "belt",
) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute("size", new Float32BufferAttribute(size, 1));
    geometry.setAttribute("bright", new Float32BufferAttribute(bright, 1));
    geometry.setAttribute("tint", new Float32BufferAttribute(tint, 3));
    const material = new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
        defines:
            kind === "belt"
                ? { DOT_PHASE: "", DOT_CLEAR: "" }
                : { DOT_SKY: "" },
        uniforms: {
            uDpr: { value: 1 },
            uFeather: { value: new Vector2(1, 1) },
            uDiscs: {
                value: Array.from(
                    { length: MAX_DISCS },
                    () => new Vector3(0, 0, -1),
                ),
            },
            uDiscClear: { value: 6 },
            uPrint: plate.uPrint,
            // Display-referred ink (set by the theme).
            uInk: { value: new Color() },
            // Flight Manual: which dots print (by brightness), how dark.
            uInkLimit: { value: 0 },
            uInkAlpha: { value: 0.5 },
            uLevel: { value: 1 },
        },
        vertexShader: DOT_VERTEX,
        fragmentShader: DOT_FRAGMENT,
    });
    const points = new Points(geometry, material);
    points.frustumCulled = false;
    return { points, material };
}

/**
 * The stars in front of the Milky Way: a seeded field with the sky's
 * spread of magnitudes (many faint, few bright), from blue-white to warm
 * white, concentrated toward the band's plane (the sky's y = 0). No
 * twinkle. In Flight Manual only the brightest print, as sparse ink dots.
 */
export function starField(count: number, plate: Plate, seed = 19) {
    const random = seeded(seed);
    const positions: number[] = [];
    const size: number[] = [];
    const bright: number[] = [];
    const tint: number[] = [];
    const blue = new Color(0.78, 0.86, 1.0);
    const warm = new Color(1.0, 0.92, 0.82);
    const c = new Color();
    for (let i = 0; i < count; i++) {
        // Half across the sky, half near the band.
        const lat =
            random() < 0.5
                ? Math.asin(random() * 2 - 1)
                : Math.max(-1.5, Math.min(1.5, gauss(random) * 0.22));
        const lon = random() * Math.PI * 2;
        const r = 1500;
        positions.push(
            Math.cos(lat) * Math.cos(lon) * r,
            Math.sin(lat) * r,
            Math.cos(lat) * Math.sin(lon) * r,
        );
        // Magnitude −1 to 6.5, the count growing about 2.7× per step.
        const m =
            Math.log10(1 + random() * (10 ** (0.43 * 7.5) - 1)) / 0.43 - 1;
        const k = (6.5 - m) / 7.5;
        size.push(0.6 + 1.8 * k * k);
        bright.push(Math.min(1, 0.16 + 0.84 * 10 ** (-0.4 * (m - 0.5))));
        // Blue-white to warm white, mostly white.
        c.copy(blue).lerp(warm, 0.5 + (random() - random()) * 0.5);
        tint.push(c.r, c.g, c.b);
    }
    const field = dots(positions, size, bright, tint, plate, "sky");
    // First among the see-through layers: behind every world and line.
    field.points.renderOrder = -9;
    return field;
}

/**
 * The asteroid belt: a seeded ring of grains about the Sun, a little
 * thick and clumped, faint grey and lit by phase. Flight Manual draws it
 * as a fine ink stipple.
 */
export function asteroidBelt(
    mid: number,
    half: number,
    count: number,
    plate: Plate,
    seed = 7,
) {
    const random = seeded(seed);
    const positions: number[] = [];
    const size: number[] = [];
    const bright: number[] = [];
    const tint: number[] = [];
    for (let i = 0; i < count;) {
        const a = random() * Math.PI * 2;
        // Clumps along the ring.
        const density =
            0.65 + 0.25 * Math.sin(3 * a + 1.3) + 0.1 * Math.sin(11 * a);
        if (random() > density) continue;
        i++;
        const off = (random() + random() + random() - 1.5) / 1.5;
        const r = mid + half * off;
        const y = gauss(random) * (0.18 + 0.2 * Math.abs(off));
        positions.push(Math.cos(a) * r, y, Math.sin(a) * r);
        size.push(0.8 + 0.9 * random() ** 3);
        bright.push(0.3 + 0.35 * random());
        const g = 0.72 + 0.1 * random();
        tint.push(g, g * 0.98, g * 0.95);
    }
    return dots(positions, size, bright, tint, plate, "belt");
}

/* ---- the spacecraft --------------------------------------------------------- */

/** The craft's parts, for its colours: hull, service module, dark
 *  fittings (heat shield, engine bell, booms). */
const HULL = 0;
const MODULE = 1;
const DARK = 2;

/**
 * A small spacecraft, nose along +z, in units of its length: a capsule
 * with its heat-shield band, a service module, an engine bell, and two
 * solar wings on booms. Two meshes (the body, with its parts' colours
 * per vertex, and the wings) and a plume. About 1.8 long across the
 * wings.
 */
export function spacecraft() {
    const parts: BufferGeometry[] = [];
    const kinds: number[] = [];
    const cyl = (
        top: number,
        bottom: number,
        length: number,
        z: number,
        kind: number,
        open = false,
    ) => {
        const g = new CylinderGeometry(top, bottom, length, 24, 1, open);
        g.rotateX(Math.PI / 2);
        g.translate(0, 0, z);
        parts.push(g);
        kinds.push(kind);
    };
    cyl(0.07, 0.19, 0.24, 0.33, HULL); // capsule
    cyl(0.19, 0.19, 0.04, 0.19, DARK); // heat-shield band
    cyl(0.2, 0.2, 0.4, -0.03, MODULE); // service module
    cyl(0.05, 0.12, 0.14, -0.3, DARK, true); // engine bell
    const wings: BufferGeometry[] = [];
    for (const side of [1, -1]) {
        const wing = new BoxGeometry(0.62, 0.014, 0.27);
        wing.translate(side * 0.59, 0, -0.03);
        wings.push(wing);
        const boom = new BoxGeometry(0.1, 0.012, 0.012);
        boom.translate(side * 0.24, 0, -0.03);
        parts.push(boom);
        kinds.push(DARK);
    }
    // Each part's kind on its vertices, so one theme pass can colour it.
    const kindOf: number[] = [];
    parts.forEach((g, i) => {
        const n = g.attributes.position.count;
        for (let v = 0; v < n; v++) kindOf.push(kinds[i]);
        g.setAttribute(
            "color",
            new Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3),
        );
    });
    const bodyGeometry = mergeGeometries(parts)!;
    const wingGeometry = mergeGeometries(wings)!;
    for (const g of [...parts, ...wings]) g.dispose();
    const body = new MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.55,
        metalness: 0.15,
        transparent: true,
    });
    const wing = new MeshStandardMaterial({
        roughness: 0.38,
        metalness: 0.35,
        transparent: true,
    });
    const craft = new Group();
    craft.add(new Mesh(bodyGeometry, body), new Mesh(wingGeometry, wing));

    // The burn: an open cone from the nozzle, fading down its length and
    // toward its edges.
    const cone = new ConeGeometry(0.13, 1, 24, 8, true);
    cone.rotateX(-Math.PI / 2);
    cone.translate(0, 0, -0.5);
    const plume = new ShaderMaterial({
        side: DoubleSide,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
        uniforms: {
            uEnv: { value: 0 },
            uColor: { value: new Color() },
            uLevel: { value: 0.9 },
        },
        vertexShader: /* glsl */ `
varying float vT;
varying float vFace;
void main() {
    vT = clamp(-position.z, 0.0, 1.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vFace = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
}`,
        fragmentShader: /* glsl */ `
uniform float uEnv;
uniform vec3 uColor;
uniform float uLevel;
varying float vT;
varying float vFace;
void main() {
    float a = uEnv * (0.35 + 0.65 * pow(vFace, 1.2)) * pow(1.0 - vT, 1.8);
    gl_FragColor = vec4(uColor, a * uLevel);
    #include <colorspace_fragment>
}`,
    });
    const flame = new Mesh(cone, plume);
    flame.position.z = -0.37;
    craft.add(flame);

    /** Colours the craft from the theme (linear colours). */
    const paint = (hull: Color, module: Color, dark: Color) => {
        const colour = bodyGeometry.attributes.color;
        const by = [hull, module, dark];
        for (let v = 0; v < colour.count; v++) {
            const c = by[kindOf[v]];
            colour.setXYZ(v, c.r, c.g, c.b);
        }
        colour.needsUpdate = true;
    };
    return { craft, body, wing, plume, flame, paint, span: 1.8 };
}
