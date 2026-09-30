import {
    AdditiveBlending,
    AmbientLight,
    BufferGeometry,
    CanvasTexture,
    Color,
    ConeGeometry,
    DoubleSide,
    Float32BufferAttribute,
    Group,
    InstancedBufferAttribute,
    type InterleavedBufferAttribute,
    Mesh,
    MeshBasicMaterial,
    MeshLambertMaterial,
    NormalBlending,
    Object3D,
    PerspectiveCamera,
    PlaneGeometry,
    PointLight,
    Points,
    PointsMaterial,
    RingGeometry,
    Scene,
    ShaderMaterial,
    SphereGeometry,
    SRGBColorSpace,
    Sprite,
    SpriteMaterial,
    TextureLoader,
    Vector2,
    Vector3,
    Vector4,
    WebGLRenderer,
    type Material,
    type Texture,
} from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { Frame, Route, TrajectoryData } from "@/lib/trajectory";
import {
    CRANE,
    LABEL_FADE,
    RING,
    buildFlight,
    inset,
    labelBox,
    labelGap,
    labelSafe,
    lerp,
    minWorldPx,
    onPlane,
    pointBox,
    ringReach,
    roomGap,
    screenOf,
    smoothstep,
    stageFrame,
    type Box,
    type LabelSide,
    type Pose,
    type Stage,
    type Vec3,
    type World,
    type WorldKind,
} from "./flight-route";

/**
 * The 3D flight's renderer (option C), loaded lazily by flight-scene.ts:
 * this module and three.js are one chunk that the page fetches only after
 * the scene mounts. It draws on request (a scroll frame, a resize, a
 * texture arriving), never in a loop, and every pose comes from
 * flight-route.ts, so any progress renders the same picture.
 */

export interface FlightGL {
    /** `record`: on a phone, the record's top edge on the stage (pixels);
     *  nothing is drawn below it. `caption`: the figure's caption on the
     *  stage (pixels), which no line or label enters. */
    resize(
        width: number,
        height: number,
        wide: boolean,
        record?: number,
        caption?: Box,
    ): void;
    render(frame: Frame): void;
    theme(): void;
    dispose(): void;
}

export interface FlightHooks {
    /** The layer the HTML labels go in, and their classes. */
    labels: HTMLElement;
    classes: {
        label: string;
        name: string;
        dates: string;
        now: string;
        target: string;
        world: string;
        leader: string;
    };
    /** The planned orbit's label ("Open to"). */
    openTo: string;
    /** The first frame is on screen with its textures (or without them). */
    ready(): void;
}

const TEXTURE: Record<WorldKind, string> = {
    earth: "/images/trajectory/earth-2k.webp",
    mars: "/images/trajectory/mars-2k.webp",
    jupiter: "/images/trajectory/jupiter-2k.webp",
    saturn: "/images/trajectory/saturn-1k.webp",
};
const RING_TEXTURE = "/images/trajectory/saturn-ring-1k.webp";
/** Until a map arrives, a world is its average colour. */
const TINT: Record<WorldKind, string> = {
    earth: "#5d6b82",
    mars: "#9a6446",
    jupiter: "#a8927a",
    saturn: "#c4b18d",
};
const MAX_DPR = 1.75;
const TRAIL_SAMPLES = 2400;
/** The ship stays about this many pixels long at any distance. */
const SHIP_PX = 21;
/** The Sun's brightness in the map: its core no brighter than the labels
 *  (0.88 of white, from 2.6 over the limb darkening), so the route and
 *  the now mark lead. */
const SUN_LEVEL_MAP = 0.34;
/** No orbit is drawn across a world's disc on screen: the line stops this
 *  many pixels short of the limb, fading in over the second (Saturn's
 *  short of its ring's tips, about twice its radius from the chase). */
const ORBIT_CLEAR = [5, 14];
const SATURN_CLEAR = 2;
/** On a wide stage the lines fade out under the record's scrim, between
 *  these shares of the width (gone before the record's text column). */
const LINE_MASK = [0.3, 0.46];
/** Worlds whose discs the orbits keep clear of (the rest are ignored). */
const MAX_DISCS = 8;
/** Lines fade out from this far outside the caption's box to this far
 *  (pixels), and labels stay this far above it. */
const CAPTION_CLEAR = [22, 6];
/** A box no line reaches (the keep-out box when there is no caption). */
const NOWHERE = new Vector4(-1e4, -1e4, -9e3, -9e3);

/**
 * Extra terms in three.js's line shader (LineMaterial), each a factor on
 * the fragment's alpha:
 * - a screen mask (uMask: x from, x to, y from, y to, device pixels), so
 *   no line runs under the record;
 * - a keep-out box (uKeep: x0, y0, x1, y1, device pixels; uKeepSoft: the
 *   fade outside it), so no line runs through the figure's caption;
 * - LINE_AGE: the flown trail dims with age (uAge: the head's progress,
 *   the fade length, the floor), from a per-segment progress;
 * - LINE_CLEAR: an orbit stops short of every world's disc on screen
 *   (uDiscs: x, y, radius, device pixels; uClear: the gap's two edges).
 * Null when three.js's shader no longer has the lines this patches.
 */
const LINE_VERTEX_AT = "vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );";
const LINE_FRAGMENT_AT = "gl_FragColor = vec4( diffuseColor.rgb, alpha );";
export function patchLineShader(vertex: string, fragment: string) {
    if (
        !vertex.includes(LINE_VERTEX_AT) ||
        !fragment.includes(LINE_FRAGMENT_AT)
    )
        return null;
    return {
        vertex:
            /* glsl */ `
#ifdef LINE_AGE
attribute float instanceAge;
varying float vAge;
#endif
` +
            vertex.replace(
                LINE_VERTEX_AT,
                `${LINE_VERTEX_AT}
#ifdef LINE_AGE
vAge = instanceAge;
#endif`,
            ),
        fragment:
            /* glsl */ `
uniform vec4 uMask;
uniform vec4 uKeep;
uniform float uKeepSoft;
#ifdef LINE_AGE
uniform vec3 uAge;
varying float vAge;
#endif
#ifdef LINE_CLEAR
uniform vec3 uDiscs[${MAX_DISCS}];
uniform vec2 uClear;
#endif
` +
            fragment.replace(
                LINE_FRAGMENT_AT,
                /* glsl */ `alpha *= smoothstep(uMask.x, uMask.y, gl_FragCoord.x)
    * smoothstep(uMask.z, uMask.w, gl_FragCoord.y);
vec2 kept = max(uKeep.xy - gl_FragCoord.xy, gl_FragCoord.xy - uKeep.zw);
alpha *= smoothstep(0.0, uKeepSoft, max(kept.x, kept.y));
#ifdef LINE_AGE
alpha *= mix(uAge.z, 1.0, exp(-max(uAge.x - vAge, 0.0) / uAge.y));
#endif
#ifdef LINE_CLEAR
for (int i = 0; i < ${MAX_DISCS}; i++) {
    vec3 d = uDiscs[i];
    if (d.z > 0.0)
        alpha *= smoothstep(d.z + uClear.x, d.z + uClear.y,
            distance(gl_FragCoord.xy, d.xy));
}
#endif
${LINE_FRAGMENT_AT}`,
            ),
    };
}

function seeded(seed: number) {
    let a = seed | 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function radial(stops: [number, string][], size = 256) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2,
    );
    for (const [at, color] of stops) g.addColorStop(at, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
}

const RIM_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
}`;
const RIM_FRAGMENT = /* glsl */ `
uniform vec3 color;
uniform vec3 sun;
uniform float strength;
varying vec3 vNormal;
varying vec3 vView;
void main() {
    float rim = pow(1.0 - max(dot(vNormal, vView), 0.0), 3.2);
    float day = smoothstep(-0.25, 0.55, dot(vNormal, sun));
    gl_FragColor = vec4(color * rim * day * strength, 1.0);
}`;

/**
 * The Sun: one camera-facing quad at its centre, sized in pixels, so it
 * is depth-tested there (a world in front hides it) and never culled.
 * Void: a limb-darkened disc of warm white with a windowed corona,
 * dithered so its falloff doesn't band. Flight Manual: the printed ☉, a
 * ring, a centre dot and sixteen ray ticks in ink.
 */
const SUN_VERTEX = /* glsl */ `
uniform float uExtent;
uniform float uKpx;
varying vec2 vPx;
void main() {
    vPx = position.xy * uExtent;
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mv.xy += vPx * (-mv.z / uKpx);
    gl_Position = projectionMatrix * mv;
}`;
const SUN_FRAGMENT = /* glsl */ `
uniform float uR;
uniform float uRmax;
uniform float uCorona;
uniform float uLevel;
uniform float uPrint;
uniform vec3 uInk;
varying vec2 vPx;
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}
void main() {
    float r = length(vPx);
    if (uPrint > 0.5) {
        float ring = 1.0 - smoothstep(0.1, 1.1, abs(r - uR));
        float centre = 1.0 - smoothstep(0.6, 1.6, r);
        float slot = 6.2831853 / 16.0;
        float a = atan(vPx.y, vPx.x);
        float off = abs(fract(a / slot + 0.5) - 0.5) * slot * r;
        float ray = (1.0 - smoothstep(0.2, 0.9, off))
            * smoothstep(uR + 3.5, uR + 4.5, r)
            * (1.0 - smoothstep(uR + 8.5, uR + 9.5, r));
        gl_FragColor = vec4(uInk, max(max(ring, centre), ray));
        return;
    }
    float x = min(r / uR, 1.0);
    float mu = sqrt(1.0 - x * x);
    float limb = 1.0 - 0.6 * (1.0 - mu) - 0.12 * (1.0 - mu) * (1.0 - mu);
    float disc = 1.0 - smoothstep(uR - 0.8, uR + 0.8, r);
    float rr = max(r, uR);
    float corona = (1.6 * exp(-(rr - uR) / (0.35 * uR))
        + 0.4 * (uR / rr) * (uR / rr))
        * (1.0 - smoothstep(0.55 * uRmax, uRmax, r)) * uCorona;
    vec3 c = (vec3(1.0, 0.975, 0.94) * 2.6 * limb * disc
        + vec3(1.0, 0.94, 0.86) * corona * (1.0 - disc)) * uLevel;
    c += (hash(gl_FragCoord.xy) - 0.5) / 255.0 * step(r, uRmax);
    gl_FragColor = vec4(max(c, 0.0), 1.0);
}`;

export function mountFlight(
    host: HTMLElement,
    data: TrajectoryData,
    route: Route,
    hooks: FlightHooks,
): FlightGL | null {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2", {
        antialias: true,
        alpha: false,
        stencil: false,
        powerPreference: "default",
    });
    if (!context) return null;
    let renderer: WebGLRenderer;
    try {
        renderer = new WebGLRenderer({ canvas, context, antialias: true });
    } catch {
        return null;
    }
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setPixelRatio(Math.min(MAX_DPR, window.devicePixelRatio || 1));
    host.prepend(canvas);

    const plan = buildFlight(data, route);
    const root = document.documentElement;
    const scene = new Scene();
    const camera = new PerspectiveCamera(38, 1, 0.05, 4000);
    const textures: Texture[] = [];
    const lineMaterials: LineMaterial[] = [];
    let disposed = false;
    let last: Frame | null = null;
    let W = 1;
    let H = 1;
    /** Labels and marks sit on whole device pixels, so their text is
     *  drawn the same however the page was scrolled to a frame. */
    let cssDpr = 1;
    const snap = (v: number) => (Math.round(v * cssDpr) / cssDpr).toFixed(2);
    /** The lens, the subject's box and the framing (flight-route.ts). */
    let stage: Stage = stageFrame(1, 1, true);
    let wideLayout = true;

    /* ---- light, Sun and stars ------------------------------------------ */

    const sunLight = new PointLight(0xffffff, 3.3, 0, 0);
    const ambient = new AmbientLight(0xffffff, 0.12);
    scene.add(sunLight, ambient);

    const sunMaterial = new ShaderMaterial({
        vertexShader: SUN_VERTEX,
        fragmentShader: SUN_FRAGMENT,
        uniforms: {
            uExtent: { value: 1 },
            uKpx: { value: 1 },
            uR: { value: 1 },
            uRmax: { value: 1 },
            uCorona: { value: 1 },
            uLevel: { value: 1 },
            uPrint: { value: 0 },
            uInk: { value: new Color() },
        },
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
    });
    const sunDisc = new Mesh(new PlaneGeometry(2, 2), sunMaterial);
    sunDisc.frustumCulled = false;
    scene.add(sunDisc);
    const glowTexture = radial([
        [0, "rgba(255,253,248,1)"],
        [0.06, "rgba(255,248,236,0.92)"],
        [0.16, "rgba(255,238,218,0.36)"],
        [0.34, "rgba(255,232,210,0.1)"],
        [0.6, "rgba(255,230,210,0.025)"],
        [1, "rgba(255,230,210,0)"],
    ]);
    textures.push(glowTexture);

    const dotTexture = radial(
        [
            [0, "rgba(255,255,255,1)"],
            [0.45, "rgba(255,255,255,0.85)"],
            [1, "rgba(255,255,255,0)"],
        ],
        32,
    );
    textures.push(dotTexture);
    const stars = new Group();
    const random = seeded(19);
    const starLayers = [
        { count: 2600, size: 1, alpha: 0.34 },
        { count: 700, size: 1.5, alpha: 0.55 },
        { count: 110, size: 2.3, alpha: 0.85 },
    ].map(({ count, size, alpha }) => {
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            // Uniform on the sphere, a little denser near the ecliptic.
            const z = (random() * 2 - 1) * (0.55 + 0.45 * random());
            const a = random() * Math.PI * 2;
            const r = Math.sqrt(1 - z * z) * 1500;
            positions.set([Math.cos(a) * r, z * 1500, Math.sin(a) * r], i * 3);
        }
        const geometry = new BufferGeometry();
        geometry.setAttribute(
            "position",
            new Float32BufferAttribute(positions, 3),
        );
        const material = new PointsMaterial({
            size,
            sizeAttenuation: false,
            map: dotTexture,
            transparent: true,
            depthWrite: false,
            opacity: alpha,
        });
        const points = new Points(geometry, material);
        stars.add(points);
        return { material, alpha };
    });
    scene.add(stars);

    /* ---- lines ------------------------------------------------------------ */

    // Shared by the lines: the record's mask, the discs the orbits keep
    // clear of, and the trail's age (set in resize() and draw()).
    const mask = { value: new Vector4(-2, -1, -2, -1) };
    const keepOut = { value: NOWHERE.clone() };
    const keepSoft = { value: 1 };
    const discs = {
        value: Array.from({ length: MAX_DISCS }, () => new Vector3(0, 0, -1)),
    };
    const clear = { value: new Vector2(...ORBIT_CLEAR) };
    const age = { value: new Vector3(0, 1, 1) };
    const makeLine = (
        points: Vec3[],
        width: number,
        {
            dashed = false,
            orbit = false,
            ages = null as Float32Array | null,
        } = {},
    ): { line: Line2; material: LineMaterial; geometry: LineGeometry } => {
        const geometry = new LineGeometry();
        geometry.setPositions(points.flat());
        const material = new LineMaterial({
            linewidth: width,
            transparent: true,
            depthWrite: false,
            dashed,
            dashSize: 1,
            gapSize: 0.8,
        });
        const patched = patchLineShader(
            material.vertexShader,
            material.fragmentShader,
        );
        if (patched) {
            material.vertexShader = patched.vertex;
            material.fragmentShader = patched.fragment;
            material.uniforms.uMask = mask;
            material.uniforms.uKeep = keepOut;
            material.uniforms.uKeepSoft = keepSoft;
            if (orbit) {
                material.defines.LINE_CLEAR = "";
                material.uniforms.uDiscs = discs;
                material.uniforms.uClear = clear;
            }
            if (ages) {
                material.defines.LINE_AGE = "";
                material.uniforms.uAge = age;
                geometry.setAttribute(
                    "instanceAge",
                    new InstancedBufferAttribute(ages, 1),
                );
            }
        }
        lineMaterials.push(material);
        const line = new Line2(geometry, material);
        if (dashed) line.computeLineDistances();
        line.frustumCulled = false;
        scene.add(line);
        return { line, material, geometry };
    };
    const ring = (orbit: number, pl: World["plane"], steps = 384): Vec3[] =>
        Array.from({ length: steps + 1 }, (_, k) =>
            onPlane(pl, orbit, (k / steps) * Math.PI * 2),
        );

    const orbits = plan.worlds.map((w) =>
        makeLine(ring(w.orbit, w.plane), 1.2, { orbit: true }),
    );
    const plannedOrbit = plan.planned
        ? makeLine(ring(plan.planned.orbit, plan.planned.plane, 512), 1, {
              dashed: true,
          })
        : null;
    const plannedLeg = plan.planned
        ? makeLine(plan.planned.path, 1.4, { dashed: true })
        : null;

    // The trail: flown in ink, dimming with age, the current leg in the
    // accent at full strength. Each is drawn to the sample before the
    // ship, then one segment to the ship itself.
    const samples = plan.trail(TRAIL_SAMPLES);
    const flown = route.flown || 1;
    const iCur =
        plan.current < 0
            ? TRAIL_SAMPLES - 1
            : Math.round((plan.currentFrom / flown) * (TRAIL_SAMPLES - 1));
    const pOf = (k: number) => (k / (TRAIL_SAMPLES - 1)) * flown;
    const past = makeLine(samples.slice(0, iCur + 1), 1.8, {
        ages: Float32Array.from({ length: Math.max(1, iCur) }, (_, k) =>
            pOf(k),
        ),
    });
    const cur =
        iCur < TRAIL_SAMPLES - 1 ? makeLine(samples.slice(iCur), 2.2) : null;
    // A trail segment fades over about one leg of the route.
    const fadeLen =
        flown /
        Math.max(1, route.segments.filter((s) => s.kind !== "plan").length);
    const heads = new Map<LineGeometry, { index: number; saved: Vec3 }>();
    const drawTo = (
        part: { line: Line2; geometry: LineGeometry },
        segments: number,
        head: Vec3 | null,
    ) => {
        const { geometry, line } = part;
        const start = geometry.attributes
            .instanceStart as InterleavedBufferAttribute;
        const buffer = start.data;
        const array = buffer.array as Float32Array;
        // Only the vertices that change are uploaded.
        const write = (at: number, value: ArrayLike<number>) => {
            array.set(value, at);
            buffer.addUpdateRange(at, 3);
            buffer.needsUpdate = true;
        };
        const was = heads.get(geometry);
        if (was) {
            write(was.index * 6 + 3, was.saved);
            heads.delete(geometry);
        }
        const n = Math.max(0, Math.min(start.count, segments));
        line.visible = n > 0;
        geometry.instanceCount = n;
        if (head && n > 0) {
            const index = n - 1;
            heads.set(geometry, {
                index,
                saved: Array.from(
                    array.subarray(index * 6 + 3, index * 6 + 6),
                ) as Vec3,
            });
            write(index * 6 + 3, head);
        }
    };
    // In the map the opening loop moves with Earth (plan.carry): its
    // samples are rewritten as the map rises, in whichever part holds them.
    let opening = 0;
    while (
        opening < TRAIL_SAMPLES - 1 &&
        plan.carry(pOf(opening + 1), 1).some((c) => c !== 0)
    )
        opening++;
    let carried = 0;
    const carryOpening = (overview: number) => {
        if (opening === 0 || overview === carried) return;
        carried = overview;
        for (const [part, from] of [
            [past, 0],
            [cur, iCur],
        ] as const) {
            if (!part) continue;
            const start = part.geometry.attributes
                .instanceStart as InterleavedBufferAttribute;
            const buffer = start.data;
            const array = buffer.array as Float32Array;
            const head = heads.get(part.geometry);
            const last = Math.min(opening - from, start.count);
            if (last < 0) continue;
            for (let j = 0; j <= last; j++) {
                const k = j + from;
                const c = plan.carry(pOf(k), overview);
                const q: Vec3 = [
                    samples[k][0] + c[0],
                    samples[k][1] + c[1],
                    samples[k][2] + c[2],
                ];
                if (j < start.count) array.set(q, j * 6);
                if (j === 0) continue;
                // The segment before ends here, unless it ends on the ship.
                if (head?.index === j - 1) head.saved = q;
                else array.set(q, (j - 1) * 6 + 3);
            }
            buffer.addUpdateRange(0, (last + 1) * 6);
            buffer.needsUpdate = true;
        }
    };

    /* ---- worlds ---------------------------------------------------------- */

    const loader = new TextureLoader();
    let pending = 0;
    let revealed = false;
    const reveal = () => {
        if (revealed || disposed) return;
        revealed = true;
        hooks.ready();
    };
    const revealTimer = window.setTimeout(reveal, 4000);
    const load = (url: string, onLoad: (texture: Texture) => void) => {
        pending++;
        const texture = loader.load(
            url,
            (t) => {
                if (disposed) return;
                t.colorSpace = SRGBColorSpace;
                t.anisotropy = Math.min(
                    8,
                    renderer.capabilities.getMaxAnisotropy(),
                );
                onLoad(t);
                pending--;
                if (last) draw(last);
                if (pending === 0) reveal();
            },
            undefined,
            () => {
                pending--;
                if (pending === 0) reveal();
            },
        );
        textures.push(texture);
    };

    const sunDir = new Vector3();
    const rims: ShaderMaterial[] = [];
    const bodies = plan.worlds.map((w) => {
        const tilt = new Group();
        tilt.quaternion.setFromUnitVectors(
            new Vector3(0, 1, 0),
            new Vector3(...w.pole),
        );
        const material = new MeshLambertMaterial({ color: TINT[w.kind] });
        const globe = new Mesh(new SphereGeometry(w.radius, 72, 36), material);
        tilt.add(globe);
        load(TEXTURE[w.kind], (t) => {
            material.map = t;
            material.color.set(0xffffff);
            material.needsUpdate = true;
        });
        if (w.kind === "earth") {
            const rim = new ShaderMaterial({
                vertexShader: RIM_VERTEX,
                fragmentShader: RIM_FRAGMENT,
                uniforms: {
                    color: { value: new Color(0.55, 0.72, 1) },
                    sun: { value: new Vector3(1, 0, 0) },
                    strength: { value: 1.25 },
                },
                blending: AdditiveBlending,
                transparent: true,
                depthWrite: false,
            });
            rims.push(rim);
            tilt.add(
                new Mesh(new SphereGeometry(w.radius * 1.04, 64, 32), rim),
            );
        }
        if (w.kind === "saturn") {
            const inner = w.radius * RING.inner;
            const outer = w.radius * RING.outer;
            const geometry = new RingGeometry(inner, outer, 160, 1);
            const pos = geometry.attributes.position;
            const uv = geometry.attributes.uv;
            for (let i = 0; i < pos.count; i++) {
                const r = Math.hypot(pos.getX(i), pos.getY(i));
                uv.setXY(i, (r - inner) / (outer - inner), 0.5);
            }
            geometry.rotateX(-Math.PI / 2);
            const material = new MeshBasicMaterial({
                color: 0xd8d2c6,
                side: DoubleSide,
                transparent: true,
                depthWrite: false,
                opacity: 0,
            });
            load(RING_TEXTURE, (t) => {
                material.map = t;
                material.opacity = 1;
                material.needsUpdate = true;
            });
            tilt.add(new Mesh(geometry, material));
        }
        scene.add(tilt);
        /** Its radius on the stage, true and as drawn (pixels). */
        return { w, tilt, globe, px: 1, drawn: 1 };
    });

    /* ---- the ship --------------------------------------------------------- */

    const ship = new Group();
    const hull = new ConeGeometry(0.26, 1, 20, 1);
    hull.rotateX(Math.PI / 2);
    const shipMaterial = new MeshLambertMaterial({
        color: 0xffffff,
        transparent: true,
    });
    const shipMesh = new Mesh(hull, shipMaterial);
    ship.add(shipMesh);
    const beaconMaterial = new SpriteMaterial({
        map: glowTexture,
        blending: AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.55,
    });
    const beacon = new Sprite(beaconMaterial);
    beacon.scale.setScalar(1.3);
    ship.add(beacon);
    scene.add(ship);

    /* ---- labels ----------------------------------------------------------- */

    const makeLabel = (name: string, dates: string | null) => {
        const el = document.createElement("div");
        el.className = hooks.classes.label;
        const b = document.createElement("b");
        b.className = hooks.classes.name;
        b.textContent = name;
        el.append(b);
        if (dates) {
            const s = document.createElement("span");
            s.className = hooks.classes.dates;
            s.textContent = dates;
            el.append(s);
        }
        // The leader: a hairline from the world's limb to the label.
        const leader = document.createElement("i");
        leader.className = hooks.classes.leader;
        hooks.labels.append(leader, el);
        return { el, leader, w: 0, h: 0, state: "" };
    };
    const labels = data.chapters.map((c) => makeLabel(c.orgLabel, c.dates));
    // A hollow ring on each world where it is only a few pixels wide.
    const rings = data.chapters.map(() => {
        const el = document.createElement("div");
        el.className = hooks.classes.world;
        hooks.labels.append(el);
        return el;
    });
    const openLabel = plan.planned ? makeLabel(hooks.openTo, null) : null;
    const nowMark = document.createElement("div");
    nowMark.className = hooks.classes.now;
    const targetMark = document.createElement("div");
    targetMark.className = hooks.classes.target;
    hooks.labels.append(nowMark, targetMark);
    const measureLabels = () => {
        for (const l of [...labels, openLabel]) {
            if (!l) continue;
            l.w = l.el.offsetWidth;
            l.h = l.el.offsetHeight;
        }
    };

    /* ---- theme -------------------------------------------------------------- */

    const palette = {
        ink1: new Color(),
        ink2: new Color(),
        ink3: new Color(),
        accent: new Color(),
        light: false,
    };
    const applyTheme = () => {
        const css = getComputedStyle(root);
        const token = (name: string, fallback: string) =>
            css.getPropertyValue(name).trim() || fallback;
        const bg = new Color(token("--bg", "#050507"));
        palette.ink1.setStyle(token("--ink-1", "#ece8df"));
        palette.ink2.setStyle(token("--ink-2", "#bcb7ad"));
        palette.ink3.setStyle(token("--ink-3", "#8f8a80"));
        palette.accent.setStyle(token("--accent", "#ff5a1f"));
        const hsl = { h: 0, s: 0, l: 0 };
        bg.getHSL(hsl);
        const light = hsl.l > 0.5;
        palette.light = light;
        renderer.setClearColor(bg, 1);

        // Void: a star, added to the black. Flight Manual: the printed ☉
        // in ink on paper, with no wash; the worlds a little brighter on
        // their night side, like a printed plate.
        sunMaterial.blending = light ? NormalBlending : AdditiveBlending;
        sunMaterial.uniforms.uPrint.value = light ? 1 : 0;
        sunMaterial.uniforms.uInk.value.copy(palette.ink1);
        beacon.visible = !light;
        ambient.intensity = light ? 0.5 : 0.05;
        sunLight.intensity = light ? 3.1 : 3.3;
        const starColor = new Color(
            `rgb(${token("--star-rgb", "236 232 223").split(/\s+/).join(",")})`,
        );
        starLayers.forEach((layer) => {
            layer.material.color.copy(starColor);
            layer.material.opacity = layer.alpha * (light ? 0.55 : 1);
        });
        shipMaterial.color.copy(palette.ink1);
        shipMaterial.emissive
            .copy(light ? palette.ink1 : palette.ink2)
            .multiplyScalar(light ? 0.6 : 0.55);
        for (const rim of rims) rim.uniforms.strength.value = light ? 0 : 1.25;
        past.material.color.copy(palette.ink2);
        past.material.opacity = light ? 0.9 : 0.8;
        if (cur) {
            cur.material.color.copy(palette.accent);
            cur.material.opacity = 1;
        }
        if (plannedLeg) {
            plannedLeg.material.color.copy(palette.ink2);
            plannedLeg.material.opacity = 0.9;
        }
        if (plannedOrbit) {
            plannedOrbit.material.color.copy(palette.ink3);
            plannedOrbit.material.opacity = light ? 0.7 : 0.6;
        }
    };
    applyTheme();
    // `themechange` can fire before a view transition swaps the theme, so
    // the swap itself is watched too.
    const themeWatch = new MutationObserver(() => {
        applyTheme();
        if (last) draw(last);
    });
    themeWatch.observe(root, {
        attributes: true,
        attributeFilter: ["data-theme"],
    });

    /* ---- a frame ---------------------------------------------------------- */

    const v = new Vector3();
    const forward = new Vector3();
    const eyeV = new Vector3();
    let view: Pose | null = null;
    const looped = plan.looped;
    const coastStart = plan.worlds.map(
        (w) =>
            route.segments.find(
                (s) =>
                    s.chapter === w.chapter &&
                    (s.kind === "coast" || s.kind === "flyby"),
            )?.p0 ?? 0,
    );

    /** A point on the stage for the frame's pose: the same projection
     *  the camera renders with (flight-route.ts screenOf). */
    const project = (p: Vec3) => {
        const s = view ? screenOf(view, stage, p) : { x: -W, y: -H, depth: 0 };
        return { x: s.x, y: s.y, depth: s.depth, on: s.depth > camera.near };
    };
    /** How far a box reaches past the safe area (negative: inside). */
    const overflow = (b: Box) =>
        Math.max(
            safe.x0 - b.x0,
            b.x1 - safe.x1,
            safe.y0 - b.y0,
            b.y1 - safe.y1,
        );
    /** 1 well inside the safe area, 0 at its edge: labels and marks fade
     *  out as they reach the record, the caption or the stage's edge. */
    const keep = (b: Box, soft: number) =>
        1 - smoothstep(-soft, 0, overflow(b));
    /** Where a label sits well clear of the edge of its safe area. */
    let room: Box = inset(labelSafe(stage), LABEL_FADE);
    const setOpacity = (el: HTMLElement, a: number) => {
        el.style.opacity = a > 0.01 ? a.toFixed(3) : "0";
        return a > 0.01;
    };
    /**
     * A label `gap` pixels off its world toward `side` (a direction on the
     * stage), with a leader from `limb` pixels off the centre. Its box
     * fades as it nears the edge of the safe area; it never slides along
     * it. Under a world on a phone (`hang` 1) it hangs from the leader at
     * the share of its width that its world is across the stage, so it
     * stays on the stage without changing side.
     */
    const place = (
        label: ReturnType<typeof makeLabel>,
        at: { x: number; y: number; on: boolean },
        side: { x: number; y: number },
        gap: number,
        limb: number,
        alpha: number,
        state: string,
        hang = 0,
    ) => {
        const { el, leader } = label;
        const box = labelBox(at, side, gap, label);
        if (hang > 0) {
            const x0 = safe.x0 + LABEL_FADE;
            const x1 = safe.x1 - LABEL_FADE;
            const share = Math.min(1, Math.max(0, (at.x - x0) / (x1 - x0)));
            const dx = lerp(box.x0, at.x - share * label.w, hang) - box.x0;
            box.x0 += dx;
            box.x1 += dx;
        }
        const a = at.on ? alpha * keep(box, LABEL_FADE) : 0;
        if (label.state !== state) {
            label.state = state;
            el.dataset.state = state;
            leader.dataset.state = state;
        }
        const length = gap - limb;
        if (setOpacity(leader, a * smoothstep(4, 10, length)))
            leader.style.transform = `translate3d(${snap(at.x + side.x * limb)}px, ${snap(at.y + side.y * limb)}px, 0) rotate(${Math.atan2(side.y, side.x).toFixed(4)}rad) scaleX(${length.toFixed(1)})`;
        if (!setOpacity(el, a)) return;
        el.style.transform = `translate3d(${snap(box.x0)}px, ${snap(box.y0)}px, 0)`;
        el.style.textAlign =
            Math.abs(side.x) < 0.45 ? "center" : side.x < 0 ? "right" : "left";
    };
    /** Each world's label side: per chase segment, and in the map. */
    let chase: LabelSide[][] = [];
    let sides: LabelSide[] = [];
    let safe: Box = labelSafe(stage);
    /** The direction a share `k` of the way from side a to side b. */
    const turn = (
        a: { x: number; y: number },
        b: { x: number; y: number },
        k: number,
    ) => {
        const x = lerp(a.x, b.x, k);
        const y = lerp(a.y, b.y, k);
        const n = Math.hypot(x, y) || 1;
        return { x: x / n, y: y / n };
    };
    const dotOf = (a: { x: number; y: number }, b: { x: number; y: number }) =>
        a.x * b.x + a.y * b.y;
    /** A world's label side at a frame, and a fade. A side changes only
     *  into the map: across that boundary the label turns to its new side
     *  when that is a right angle away at most, else fades out and back
     *  in there; through the crane it turns to the map's side, or fades
     *  across where that is more than about 100° away. `hang`: under its
     *  world on a phone. */
    const sideAt = (i: number, frame: Frame, radial: number) => {
        const c = chase[frame.index]?.[i] ?? { x: -1, y: 0, reach: 1 };
        const before = chase[frame.index - 1]?.[i];
        const after = chase[frame.index + 1]?.[i];
        let side = { x: c.x, y: c.y };
        let fade = 1;
        if (before && (before.x !== c.x || before.y !== c.y)) {
            if (dotOf(before, c) > -0.05)
                side = turn(before, c, 0.5 + 0.5 * smoothstep(0, 0.1, frame.u));
            else fade *= smoothstep(0, 0.1, frame.u);
        }
        if (after && (after.x !== c.x || after.y !== c.y)) {
            if (dotOf(after, c) > -0.05)
                side = turn(side, after, 0.5 * smoothstep(0.85, 1, frame.u));
            else fade *= 1 - smoothstep(0.85, 1, frame.u);
        }
        const hang = !wideLayout && c.x === 0 ? 1 - radial : 0;
        const m = sides[i] ?? c;
        if (radial <= 0) return { side, reach: 1, fade, hang };
        if (dotOf(side, m) > -0.2)
            return {
                side: turn(side, m, radial),
                reach: lerp(1, m.reach, radial),
                fade,
                hang,
            };
        return radial < 0.5
            ? {
                  side,
                  reach: 1,
                  fade: fade * (1 - smoothstep(0.1, 0.5, radial)),
                  hang,
              }
            : {
                  side: m,
                  reach: m.reach,
                  fade: fade * smoothstep(0.5, 0.9, radial),
                  hang,
              };
    };
    const mark = (
        el: HTMLElement,
        at: { x: number; y: number; on: boolean },
        alpha: number,
    ) => {
        if (setOpacity(el, at.on ? alpha * keep(pointBox(at), 8) : 0))
            el.style.transform = `translate3d(${snap(at.x)}px, ${snap(at.y)}px, 0)`;
    };

    function draw(frame: Frame) {
        if (disposed) return;
        const { p, t, card } = frame;
        const kind = frame.segment.kind;
        const pose = plan.pose(frame, stage);
        view = pose;

        // Camera: the pose, then the lens shifted so the target sits at the
        // subject's centre (the right of the stage, or its upper part).
        const reach = Math.hypot(
            pose.eye[0] - pose.target[0],
            pose.eye[1] - pose.target[1],
            pose.eye[2] - pose.target[2],
        );
        camera.position.set(...pose.eye);
        camera.up.set(0, 1, 0);
        camera.lookAt(...pose.target);
        camera.near = Math.max(0.02, reach * 0.01);
        camera.far = reach * 4 + 3400;
        camera.updateProjectionMatrix();
        const pm = camera.projectionMatrix.elements;
        pm[8] = -(2 * pose.lens.x - 1);
        pm[9] = -(1 - 2 * pose.lens.y);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
        camera.updateMatrixWorld();
        camera.getWorldDirection(forward);
        stars.position.copy(camera.position);

        // Worlds at mission time t, moving to where their chapters ended as
        // the map rises. None is drawn under a few pixels in radius (Saturn
        // with its ring), so the map shows worlds, not empty rings.
        const minPx = minWorldPx(stage);
        for (const b of bodies) {
            const at = plan.mapAt(b.w, t, pose.overview);
            b.tilt.position.set(...at);
            b.globe.rotation.y = plan.spinAt(b.w, p);
            const depth = eyeV
                .set(...at)
                .sub(camera.position)
                .dot(forward);
            b.px = (b.w.radius * stage.kpx) / Math.max(1e-3, depth);
            b.drawn = Math.max(b.px, minPx);
            b.tilt.scale.setScalar(depth > 0 ? b.drawn / b.px : 1);
        }

        // The Sun, sized in pixels at its depth. Its corona reaches at most
        // 90px and comes in with the share of it on the stage, so it never
        // steps in; in the map it is fainter, the core at most 6px and no
        // brighter than the labels.
        const sunAt = project([0, 0, 0]);
        sunDisc.visible = sunAt.depth > camera.near;
        if (sunDisc.visible) {
            const u = sunMaterial.uniforms;
            let R = (1.5 * stage.kpx) / sunAt.depth;
            R -= pose.overview * Math.max(0, R - 6);
            const Rmax = Math.min(0.35 * H, 8 * R, 90);
            const span = (a: number, lo: number, hi: number) =>
                Math.max(0, Math.min(a + Rmax, hi) - Math.max(a - Rmax, lo)) /
                (2 * Rmax);
            u.uR.value = R;
            u.uRmax.value = Rmax;
            u.uLevel.value = 1 + (SUN_LEVEL_MAP - 1) * pose.overview;
            u.uCorona.value =
                span(sunAt.x, 0, W) *
                span(sunAt.y, 0, H) *
                (1 - 0.6 * pose.overview);
            u.uExtent.value = palette.light ? R + 10 : Math.max(Rmax, R + 2);
            u.uKpx.value = stage.kpx;
        }
        if (rims.length) {
            const earth = bodies.find((b) => b.w.kind === "earth");
            if (earth) {
                sunDir
                    .copy(earth.tilt.position)
                    .negate()
                    .normalize()
                    .transformDirection(camera.matrixWorldInverse);
                for (const rim of rims) rim.uniforms.sun.value.copy(sunDir);
            }
        }

        // Orbits: visited in ink-2, the held world's brighter, future dim.
        // Through a transfer the orbit ahead comes up to current as the one
        // left behind settles to visited. Each stops short of every disc.
        const seg = frame.segment;
        const world = Math.min(card, labels.length - 1);
        const into = seg.kind === "transfer" ? seg.chapter : -1;
        const from = seg.kind === "transfer" ? (seg.from ?? -1) : -1;
        const dpr = renderer.getPixelRatio();
        const positions = bodies.map((b) => b.tilt.position.toArray() as Vec3);
        const centres = positions.map(project);
        orbits.forEach((o, i) => {
            const visited = p >= coastStart[i] - 1e-6;
            const held =
                i === into
                    ? smoothstep(0.1, 0.5, frame.u)
                    : i === from
                      ? 1 - smoothstep(0.5, 0.9, frame.u)
                      : i === world
                        ? 1
                        : 0;
            o.material.color
                .copy(visited ? palette.ink2 : palette.ink3)
                .lerp(palette.ink1, held);
            const [bright, seen, future] = palette.light
                ? [0.72, 0.51, 0.32]
                : [0.53, 0.36, 0.17];
            o.material.opacity = lerp(visited ? seen : future, bright, held);
        });
        discs.value.forEach((d, i) => {
            const b = bodies[i];
            const at = centres[i];
            if (!b || !at.on) return d.set(0, 0, -1);
            const r = b.drawn * (b.w.kind === "saturn" ? SATURN_CLEAR : 1);
            d.set(at.x * dpr, (H - at.y) * dpr, r * dpr);
        });
        clear.value.set(ORBIT_CLEAR[0] * dpr, ORBIT_CLEAR[1] * dpr);
        if (plannedOrbit) {
            plannedOrbit.material.opacity =
                (palette.light ? 0.7 : 0.6) * (0.45 + 0.55 * pose.overview);
            // Fine, even dashes on screen at any distance.
            const px = reach / stage.kpx;
            plannedOrbit.material.dashSize = 3 * px;
            plannedOrbit.material.gapSize = 5 * px;
        }

        // The trail to the ship; the planned leg draws out in the plan.
        // Older legs sit back, less so in the map, where the whole story
        // reads.
        age.value.set(
            Math.min(p, flown),
            fadeLen,
            lerp(0.35, 0.6, pose.overview),
        );
        carryOpening(pose.overview);
        const ship3 = plan.shipAt(p);
        const upto = Math.min(p, flown) / flown;
        const idx = upto * (TRAIL_SAMPLES - 1);
        const whole = Math.floor(idx);
        const head: Vec3 = p >= flown ? samples[TRAIL_SAMPLES - 1] : ship3;
        if (whole < iCur) {
            drawTo(past, whole + 1, head);
            if (cur) drawTo(cur, 0, null);
        } else {
            drawTo(past, iCur, null);
            if (cur) drawTo(cur, whole - iCur + 1, head);
        }
        // The planned leg draws out once the map has settled.
        let planOn = 0;
        if (plannedLeg && plan.planned) {
            planOn = kind === "plan" ? smoothstep(CRANE, 0.85, frame.u) : 0;
            const n = plan.planned.path.length - 1;
            drawTo(plannedLeg, Math.round(planOn * n), null);
            const px = reach / stage.kpx;
            plannedLeg.material.dashSize = 9 * px;
            plannedLeg.material.gapSize = 6 * px;
        }

        // The ship: along its velocity, kept a few pixels long.
        const ahead = plan.shipAt(Math.min(1, p + 0.0006));
        const behind = plan.shipAt(Math.max(0, p - 0.0006));
        ship.position.set(...ship3);
        v.set(ahead[0] - behind[0], ahead[1] - behind[1], ahead[2] - behind[2]);
        if (v.lengthSq() > 1e-10) ship.lookAt(v.add(ship.position));
        const shipDepth = Math.max(
            0.1,
            eyeV.copy(ship.position).sub(camera.position).dot(forward),
        );
        // Through the crane the ship shrinks, then hands over to the now
        // mark, which has come in first: one of them is always on screen.
        const shipFade = 1 - smoothstep(0.6, 0.8, pose.overview);
        ship.scale.setScalar(
            (SHIP_PX * (1 - 0.4 * pose.overview) * shipDepth) / stage.kpx,
        );
        shipMaterial.opacity = shipFade;
        beaconMaterial.opacity = 0.55 * shipFade;
        ship.visible = shipFade > 0.001;

        // Labels: on the chase the world held and, through a transfer, the
        // one ahead; the one left behind fades as the ship leaves, by
        // progress, before the view swings away from it. The map names
        // every world on a wide stage; a phone names only the world held.
        const radial = smoothstep(0.35, 0.85, pose.overview);
        const away = (at: { x: number; y: number }) => {
            const n = Math.hypot(at.x - sunAt.x, at.y - sunAt.y) || 1;
            return { x: (at.x - sunAt.x) / n, y: (at.y - sunAt.y) / n };
        };
        labels.forEach((label, i) => {
            const b = bodies[i];
            const at = centres[i];
            const visited = p >= coastStart[i] - 1e-6;
            const state =
                i === world ? "current" : visited ? "visited" : "future";
            // The world ahead is named once the view has it on the stage.
            let alpha =
                i === into
                    ? smoothstep(0.35, 0.6, frame.u)
                    : state !== "future"
                      ? 1
                      : 0;
            if (i === from) alpha *= 1 - smoothstep(0.05, 0.25, frame.u);
            if (i !== world && i !== into && (kind !== "plan" || !wideLayout))
                alpha = 0;
            // The map's other labels come in as it settles, not as their
            // worlds sweep in through the crane.
            if (kind === "plan" && i !== world)
                alpha *= smoothstep(0.4, 0.6, frame.u);
            // Gone once its world leaves the safe area.
            alpha *= 1 - smoothstep(-16, 8, overflow(pointBox(at)));
            // A hairline ring round a world drawn at its smallest; in the
            // map a world its loop circles needs none.
            const small =
                (1 - smoothstep(3, 7, b.px)) * (looped[i] ? 1 - radial : 1);
            if (alpha * small > 0.01)
                rings[i].style.setProperty(
                    "--d",
                    `${(2 * b.drawn + 7).toFixed(1)}px`,
                );
            mark(rings[i], at, alpha * small);
            const { side, reach, fade, hang } = sideAt(i, frame, radial);
            if (alpha * fade <= 0.01) {
                place(label, at, side, 0, 0, 0, state);
                return;
            }
            // Past the disc (and ring), and on the chase clear of the route
            // flown near the world, so neither the ship nor its trail runs
            // under the label, as far as its room allows (it never fades
            // for that); the leader ends on the disc or on Saturn's ring.
            const flown =
                radial < 1
                    ? plan.flownGap(
                          i,
                          pose,
                          stage,
                          positions[i],
                          side,
                          // A phone's label hangs anywhere across its width.
                          wideLayout ? label : { w: 2 * label.w, h: label.h },
                      ) *
                      (1 - radial)
                    : 0;
            const gap = Math.max(
                labelGap(stage, b.w, at.depth, looped[i] ? 1 : radial) * reach,
                Math.min(flown, roomGap(at, side, label, room)),
            );
            const ring =
                b.w.kind === "saturn"
                    ? Math.max(1, ringReach(pose, b.w.pole, side))
                    : 1;
            place(
                label,
                at,
                side,
                gap,
                b.drawn * ring + 3,
                alpha * fade,
                state,
                hang,
            );
        });
        if (openLabel && plan.planned) {
            const at = project(plan.planned.end);
            // The planned orbit's end and its label come in as the leg
            // reaches them.
            const on = kind === "plan" ? smoothstep(0.78, 0.9, frame.u) : 0;
            place(openLabel, at, away(at), 12, 12, wideLayout ? on : 0, "plan");
            mark(targetMark, at, on);
        }
        const shipAt = project(ship3);
        mark(
            nowMark,
            shipAt,
            kind === "plan" ? smoothstep(0.45, 0.65, pose.overview) : 0,
        );

        renderer.render(scene, camera);
    }

    return {
        resize(width, height, wide, record, caption) {
            W = Math.max(1, width);
            H = Math.max(1, height);
            wideLayout = wide;
            cssDpr = window.devicePixelRatio || 1;
            renderer.setPixelRatio(
                Math.min(MAX_DPR, window.devicePixelRatio || 1),
            );
            renderer.setSize(W, H, false);
            stage = stageFrame(W, H, wide);
            camera.aspect = W / H;
            camera.fov = stage.fov;
            for (const m of lineMaterials) m.resolution.set(W, H);
            // No line under the record: on a wide stage they fade out
            // under its scrim; on a phone above its top edge.
            const dpr = renderer.getPixelRatio();
            safe = labelSafe(stage, wide ? undefined : record);
            // Nor through the caption: lines fade out round it and labels
            // keep above it.
            if (caption) {
                const [soft, pad] = CAPTION_CLEAR;
                keepOut.value.set(
                    (caption.x0 - pad) * dpr,
                    (H - caption.y1 - pad) * dpr,
                    (caption.x1 + pad) * dpr,
                    (H - caption.y0 + pad) * dpr,
                );
                keepSoft.value = (soft - pad) * dpr;
                safe.y1 = Math.min(safe.y1, caption.y0 - pad);
            } else keepOut.value.copy(NOWHERE);
            const top = record ?? stage.box.y1;
            if (wide)
                mask.value.set(
                    LINE_MASK[0] * W * dpr,
                    LINE_MASK[1] * W * dpr,
                    -2,
                    -1,
                );
            else
                mask.value.set(
                    -2,
                    -1,
                    (H - top + 6) * dpr,
                    (H - top + 28) * dpr,
                );
            measureLabels();
            room = inset(safe, LABEL_FADE);
            sides = plan.mapSides(stage, labels, wide ? openLabel : null, safe);
            chase = plan.chaseSides(
                stage,
                labels,
                safe,
                wide ? sides : undefined,
            );
            if (last) draw(last);
        },
        render(frame) {
            last = frame;
            draw(frame);
        },
        theme() {
            applyTheme();
            if (last) draw(last);
        },
        dispose() {
            disposed = true;
            window.clearTimeout(revealTimer);
            themeWatch.disconnect();
            scene.traverse((object: Object3D) => {
                const mesh = object as Mesh;
                mesh.geometry?.dispose();
                const material = mesh.material as
                    Material | Material[] | undefined;
                if (Array.isArray(material))
                    material.forEach((m) => m.dispose());
                else material?.dispose();
            });
            for (const t of textures) t.dispose();
            renderer.dispose();
            renderer.forceContextLoss();
            canvas.remove();
            hooks.labels.replaceChildren();
        },
    };
}
