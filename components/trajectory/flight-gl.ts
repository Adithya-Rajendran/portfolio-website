import {
    AdditiveBlending,
    AmbientLight,
    CanvasTexture,
    Color,
    Euler,
    Group,
    InstancedBufferAttribute,
    type InterleavedBufferAttribute,
    Light,
    Mesh,
    MeshLambertMaterial,
    MeshPhongMaterial,
    NeutralToneMapping,
    NoColorSpace,
    NoToneMapping,
    NormalBlending,
    Object3D,
    PerspectiveCamera,
    PlaneGeometry,
    PointLight,
    Quaternion,
    RingGeometry,
    Scene,
    ShaderMaterial,
    SphereGeometry,
    SRGBColorSpace,
    Sprite,
    SpriteMaterial,
    Texture,
    Vector2,
    Vector3,
    Vector4,
    WebGLRenderer,
    type Material,
} from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { Frame, Route, TrajectoryData } from "@/lib/trajectory";
import {
    MAX_DISCS,
    asteroidBelt,
    atmosphere,
    makePlate,
    milkyWay,
    ringMaterial,
    shadeGlobe,
    spacecraft,
    starField,
    type RingShadow,
} from "./flight-bodies";
import {
    CRANE,
    LABEL_FADE,
    RING,
    buildFlight,
    drawingRatio,
    inset,
    labelBox,
    labelGap,
    labelSafe,
    lerp,
    lineMask,
    mapNamesAll,
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
import {
    NIGHT_WINDOW,
    requestMap,
    type FlightMaps,
    type MapImage,
} from "./flight-maps";
import { SUN_LIFT } from "./flight-opening";

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
     *  stage (pixels), which no line or label enters. `column`: on a wide
     *  stage, the record column's right edge (pixels), which the scene
     *  keeps clear of. */
    resize(
        width: number,
        height: number,
        wide: boolean,
        record?: number,
        caption?: Box,
        column?: number,
    ): void;
    render(frame: Frame): void;
    theme(): void;
    dispose(): void;
}

interface FlightHooks {
    /** The WebGL2 context to draw with, on its own canvas (the scene
     *  makes it before it fetches anything). */
    context: WebGL2RenderingContext;
    /** The layer the HTML labels go in, and their classes. */
    labels: HTMLElement;
    /** The scrim under the record, whose ramp follows the record's column
     *  on a wide stage (--scrim-a: opaque to, --scrim-b: clear from). */
    scrim: HTMLElement;
    classes: {
        label: string;
        name: string;
        now: string;
        target: string;
        world: string;
        leader: string;
    };
    /** The planned orbit's label ("Future"). */
    openTo: string;
    /** The maps this screen loads (flight-maps.ts), and those already
     *  requested, by file. */
    maps: FlightMaps;
    images: Map<string, MapImage>;
    /** The first frame is on screen with its textures (or without them),
     *  or is back after a lost context. */
    ready(): void;
    /** The WebGL context is lost: nothing is drawn until it returns. */
    lost(): void;
}

/** Each world's shading: its wrap lighting (a softer terminator on the
 *  worlds with thick air; Mars's thin air a short dusk), and Flight
 *  Manual's tone gain, which brings each world's lit side up to about
 *  the paper. */
const LOOK: Record<
    WorldKind | "moon",
    { wrap: number; soft?: number; print: number }
> = {
    earth: { wrap: 0.05, print: 4.0 },
    mars: { wrap: 0.06, soft: 0.4, print: 1.8 },
    jupiter: { wrap: 0.1, print: 1.4 },
    saturn: { wrap: 0.1, print: 1.3 },
    moon: { wrap: 0, print: 2.0 },
};
/** A faint limb darkening and a thin rim on the day side (Void only):
 *  neutral on the gas giants, a dusty warm white on Mars. */
const LIMB: Partial<Record<WorldKind, { dark: number; rim: Color }>> = {
    jupiter: { dark: 0.28, rim: new Color(0.16, 0.16, 0.17) },
    saturn: { dark: 0.24, rim: new Color(0.15, 0.15, 0.15) },
    mars: { dark: 0, rim: new Color(0.1, 0.09, 0.08) },
};
/** Flight Manual's ambient light: a night side's detail stays faint
 *  under the print's screen of ink. */
const MANUAL_AMBIENT = 0.2;
/** Earth's oceans' glint: a soft silver patch, not a hot spot (Void;
 *  the print has none). */
const OCEAN_GLINT = new Color(0.1, 0.105, 0.12);
/** Earth's night lights: a neutral warm white, never orange. */
const CITY_LIGHTS = new Color(1, 0.93, 0.82).multiplyScalar(0.9);
/** Earthlight on the Moon's night side: faint, a little blue. */
const EARTHSHINE = new Color(0.5, 0.56, 0.66).multiplyScalar(0.12);
/** The wings' slate (under 8% chroma), a material colour. */
const WING_SLATE = "#8b929e";
/** The plume's pale blue-white in Void. */
const PLUME = "#dfe8ff";
/** The Milky Way's brightness (of the file's fourfold gain), how far it
 *  sits back in the map, so the route leads, and how much further while
 *  the camera cranes, so its core comes in behind the map gradually
 *  rather than sweeping in at once. */
const SKY_GAIN = 0.32;
const SKY_MAP_DIM = 0.8;
const SKY_CRANE_DIP = 0.15;
/** The sky fades in over this many pixels below the stage's top. */
const SKY_FEATHER = 110;
/** The belt's grains fade out this many pixels from a world's disc. */
const BELT_CLEAR = 6;
/** The sky's turn (degrees): the galaxy's plane lies 60° to the
 *  ecliptic, as it does; its turn about the ecliptic pole and the
 *  galactic centre's place along the band are set so the band crosses
 *  the sunrise, the belt, Jupiter and the map, its core behind the map. */
const GALAXY = { tilt: 60, turn: 330, core: 110 };
/** The craft's span on screen, pixels: on a wide stage a share of its
 *  height within these bounds, on a phone a set size. It narrows through
 *  a transfer's fly-to, so it never outsizes the worlds. */
const SHIP_SPAN = { share: 0.031, min: 26, max: 34, phone: 22, fly: 0.35 };
/** The craft banks this far (radians) to turn its wings to the Sun. */
const BANK = 28 * (Math.PI / 180);
/** The Sun's brightness in the map: its core no brighter than the labels
 *  (0.88 of white, from 2.6 over the limb darkening), so the route and
 *  the now mark lead. */
const SUN_LEVEL_MAP = 0.34;
/** The Sun at the sunrise, pixels: its core's radius, its glow's falloff
 *  and the glow's reach (a share of the stage's height); in Flight
 *  Manual the printed ☉ sits higher, clear of the limb (SUN_LIFT). */
const SUNRISE = { core: 9, halo: 34, reach: 0.42 };
/** No orbit is drawn across a world's disc on screen: the line stops this
 *  many pixels short of the limb, fading in over the second (Saturn's
 *  short of its ring's tips, about twice its radius from the chase). */
const ORBIT_CLEAR = [5, 14];
const SATURN_CLEAR = 2;
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
/** @internal Exported for tests. */
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

/**
 * The Sun: one camera-facing quad at its centre, sized in pixels, so it
 * is depth-tested there (a world in front hides it) and never culled.
 * Void: a limb-darkened disc of warm white with a windowed corona,
 * dithered so its falloff doesn't band; at the sunrise a small core in a
 * wide glow, rising over Earth's limb. Flight Manual: the printed ☉, a
 * ring, a centre dot and sixteen ray ticks in ink.
 */
const SUN_VERTEX = /* glsl */ `
uniform float uExtent;
uniform float uKpx;
uniform float uLift;
varying vec2 vPx;
void main() {
    vPx = position.xy * uExtent;
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mv.xy += (vPx + vec2(0.0, uLift)) * (-mv.z / uKpx);
    gl_Position = projectionMatrix * mv;
}`;
const SUN_FRAGMENT = /* glsl */ `
uniform float uR;
uniform float uRmax;
uniform float uHalo;
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
    float corona = (1.6 * exp(-(rr - uR) / uHalo)
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
    const context = hooks.context;
    const canvas = context.canvas as HTMLCanvasElement;
    let renderer: WebGLRenderer;
    try {
        renderer = new WebGLRenderer({ canvas, context, antialias: true });
    } catch {
        return null;
    }
    renderer.outputColorSpace = SRGBColorSpace;
    host.prepend(canvas);

    const plan = buildFlight(data, route);
    const root = document.documentElement;
    const scene = new Scene();
    const camera = new PerspectiveCamera(38, 1, 0.05, 4000);
    const textures: Texture[] = [];
    const lineMaterials: LineMaterial[] = [];
    let disposed = false;
    /** The context is lost (the GPU reset, or a phone reclaimed it from
     *  a background tab); `everLost`: at any time since the mount. */
    let lost = false;
    let everLost = false;
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

    /* ---- maps --------------------------------------------------------------- */

    // Each map is set on its material from the start, so its arrival only
    // uploads it (at once, not when its world first shows) and never
    // changes a shader. The scene picked the files and requested the first
    // frame's already (flight-maps.ts); each is decoded off the main
    // thread, and the uploads go one a frame, so no task takes several.
    // The canvas shows once the maps are in (in Void the sky's too, so its
    // large upload never lands mid-scroll) and the programs are compiled,
    // or after a few seconds without the maps. Their images stay, so a
    // restored context uploads them again.
    const maps = hooks.maps;
    // Asked once, before the GPU has work queued: the answer waits on it.
    const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    let pending = 0;
    let revealed = false;
    /** The maps are in, or the wait for them is over. */
    let waited = false;
    /** The first programs are compiling (compileFirst): nothing is drawn
     *  until they are in, so no draw waits on them. */
    let compiling = true;
    const reveal = () => {
        waited = true;
        if (revealed || disposed || compiling) return;
        revealed = true;
        // A context lost before the reveal shows the scene on its return.
        if (!lost) hooks.ready();
    };
    const revealTimer = window.setTimeout(reveal, 4000);
    const uploads: (() => void)[] = [];
    let uploadFrame = 0;
    const nextUpload = () => {
        uploadFrame = 0;
        if (disposed) return;
        uploads.shift()?.();
        if (uploads.length) uploadFrame = requestAnimationFrame(nextUpload);
    };
    const load = (
        file: string,
        colour = true,
        waits = true,
        then?: () => void,
    ) => {
        const texture = new Texture();
        texture.colorSpace = colour ? SRGBColorSpace : NoColorSpace;
        texture.anisotropy = anisotropy;
        textures.push(texture);
        if (waits) pending++;
        // Set on the texture at its turn, not on arrival: a draw in
        // between would upload it in that frame.
        const done = (image: ImageBitmap | HTMLImageElement | null) => {
            if (disposed) return;
            if (image) {
                texture.image = image;
                texture.needsUpdate = true;
                if (!lost) renderer.initTexture(texture);
                then?.();
                if (last) draw(last);
            }
            if (!waits || --pending > 0) return;
            warm();
            reveal();
        };
        (hooks.images.get(file) ?? requestMap(file)).then((image) => {
            if (disposed) {
                if (image instanceof ImageBitmap) image.close();
                return;
            }
            uploads.push(() => done(image));
            if (!uploadFrame) uploadFrame = requestAnimationFrame(nextUpload);
        });
        return texture;
    };

    /* ---- light, Sun and sky -------------------------------------------------- */

    const plate = makePlate();
    const sunLight = new PointLight(0xffffff, 3.3, 0, 0);
    const ambient = new AmbientLight(0xffffff, 0.012);
    scene.add(sunLight, ambient);

    const sunMaterial = new ShaderMaterial({
        vertexShader: SUN_VERTEX,
        fragmentShader: SUN_FRAGMENT,
        uniforms: {
            uExtent: { value: 1 },
            uKpx: { value: 1 },
            uLift: { value: 0 },
            uR: { value: 1 },
            uRmax: { value: 1 },
            uHalo: { value: 1 },
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

    // The sky moves with the camera, turned so the galaxy's plane lies
    // across the ecliptic: the Milky Way, and the stars in front of it.
    const sky = new Group();
    const deg = Math.PI / 180;
    sky.quaternion
        .setFromEuler(new Euler(GALAXY.tilt * deg, GALAXY.turn * deg, 0, "YXZ"))
        .multiply(
            new Quaternion().setFromAxisAngle(
                new Vector3(0, 1, 0),
                GALAXY.core * deg,
            ),
        );
    // The sky's photograph is fetched only once Void shows it.
    const galaxy = milkyWay();
    let skyMap: Texture | null = null;
    const stars = starField(6000, plate);
    sky.add(galaxy.mesh, stars.points);
    scene.add(sky);

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
        // Ink and accent exactly as the tokens: never tone-mapped.
        const material = new LineMaterial({
            linewidth: width,
            transparent: true,
            depthWrite: false,
            toneMapped: false,
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

    // The track and the parking rings, as the ship draws them: flown in
    // ink, dimming with age, the current leg (the track from its transfer
    // on, and the rings joined from there) in the accent at full strength.
    // Each is drawn to the point before the ship, then one segment to the
    // ship itself; a ring the ship has been round once stays closed.
    const flown = route.flown || 1;
    const { track } = plan;
    const end = track.points.length - 1;
    const leg = track.ps.findIndex((p) => p >= plan.currentFrom);
    const iCur = plan.current < 0 || leg < 0 ? end : leg;
    /** A segment's age: the progress at which the ship ends it. */
    const agesOf = (ps: number[], to: number) =>
        Float32Array.from({ length: Math.max(1, to) }, (_, k) => ps[k + 1]);
    const past = makeLine(track.points.slice(0, iCur + 1), 1.8, {
        ages: agesOf(track.ps, iCur),
    });
    const cur = iCur < end ? makeLine(track.points.slice(iCur), 2.2) : null;
    const parks = plan.rings.flatMap((ring, world) => {
        if (!ring) return [];
        const accent = plan.current >= 0 && ring.ps[0] >= plan.currentFrom;
        const line = makeLine(ring.points, accent ? 2.2 : 1.8, {
            ages: accent ? null : agesOf(ring.ps, ring.ps.length - 1),
        });
        return [{ ...line, ps: ring.ps, world, accent }];
    });
    /** How many of a line's points the ship has reached at progress p. */
    const reached = (ps: number[], p: number) => {
        let lo = 0;
        let hi = ps.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (ps[mid] <= p) lo = mid + 1;
            else hi = mid;
        }
        return lo;
    };
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

    /* ---- worlds ---------------------------------------------------------- */

    // Each world lit with a soft terminator and shaded for the theme; Earth
    // with its oceans' glint, city lights on its night side, clouds and
    // air; Saturn with its lit ring, each shadowing the other.
    const ringShadows: { shadow: RingShadow; radius: { value: number } }[] = [];
    let earthMaterial: MeshPhongMaterial | null = null;
    let clouds: Mesh | null = null;
    let cloudMaterial: MeshLambertMaterial | null = null;
    let air: ReturnType<typeof atmosphere> | null = null;
    const bodies = plan.worlds.map((w) => {
        const tilt = new Group();
        tilt.quaternion.setFromUnitVectors(
            new Vector3(0, 1, 0),
            new Vector3(...w.pole),
        );
        const look = { ...LOOK[w.kind], limb: LIMB[w.kind], outline: true };
        const map = load(maps.world[w.kind]);
        const shadow: RingShadow | null =
            w.kind === "saturn"
                ? {
                      map: { value: load(maps.ring) },
                      centre: { value: new Vector3() },
                      pole: { value: new Vector3(...w.pole) },
                      radii: { value: [0, 1] },
                  }
                : null;
        let material: MeshLambertMaterial | MeshPhongMaterial;
        if (w.kind === "earth") {
            material = earthMaterial = new MeshPhongMaterial({
                map,
                specularMap: load(maps.water, false),
                specular: OCEAN_GLINT,
                shininess: 28,
                emissive: CITY_LIGHTS,
                emissiveMap: load(maps.night),
            });
            // The sunrise's lands from their finer map, once it is in.
            const area = { value: new Vector4(-1, -1, 1e-3, 1e-3) };
            const [west, east] = NIGHT_WINDOW.lon;
            const [south, north] = NIGHT_WINDOW.lat;
            const fine = load(maps.nightFine, true, true, () =>
                area.value.set(
                    (west + 180) / 360,
                    (south + 90) / 180,
                    (east - west) / 360,
                    (north - south) / 180,
                ),
            );
            shadeGlobe(material, plate, {
                ...look,
                earth: true,
                keep: { box: keepOut, soft: keepSoft },
                fine: { map: { value: fine }, window: area },
            });
        } else {
            material = new MeshLambertMaterial({ map });
            shadeGlobe(material, plate, { ...look, ring: shadow ?? undefined });
        }
        const detail = w.kind === "earth" ? 128 : 72;
        const globe = new Mesh(
            new SphereGeometry(w.radius, detail, detail / 2),
            material,
        );
        tilt.add(globe);
        if (w.kind === "earth") {
            cloudMaterial = new MeshLambertMaterial({
                alphaMap: load(maps.clouds, false),
                transparent: true,
                depthWrite: false,
            });
            // White: on paper at the plain gain, so they print light only
            // where the Sun reaches them.
            shadeGlobe(cloudMaterial, plate, {
                wrap: 0.05,
                print: 1.35,
                shell: true,
            });
            clouds = new Mesh(
                new SphereGeometry(w.radius * 1.006, 96, 48),
                cloudMaterial,
            );
            air = atmosphere(w.radius);
            tilt.add(clouds, air.mesh);
        }
        if (shadow) {
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
            const radius = { value: w.radius };
            const band = new Mesh(
                geometry,
                ringMaterial(plate, shadow, radius),
            );
            // After the globe, whose shadow it takes.
            band.renderOrder = 1;
            tilt.add(band);
            ringShadows.push({ shadow, radius });
        }
        // Each world holds its place through the flight.
        tilt.position.set(...w.at);
        scene.add(tilt);
        /** Its radius on the stage, true and as drawn (pixels). */
        return { w, tilt, globe, px: 1, drawn: 1 };
    });

    // Earth's Moon, turned to show Earth its near side.
    // Earthshine keeps its night side a faint disc against the sky.
    const moonMap = plan.moon ? load(maps.moon) : null;
    const moon = plan.moon
        ? new Mesh(
              new SphereGeometry(plan.moon.radius, 48, 24),
              new MeshLambertMaterial({
                  map: moonMap,
                  emissive: EARTHSHINE,
                  emissiveMap: moonMap,
              }),
          )
        : null;
    if (moon) {
        shadeGlobe(moon.material as MeshLambertMaterial, plate, {
            ...LOOK.moon,
            lunar: true,
            outline: true,
        });
        scene.add(moon);
    }

    // The asteroid belt between Mars and Jupiter, which a transfer crosses.
    const belt = plan.belt
        ? asteroidBelt(plan.belt.mid, plan.belt.half, 3000, plate)
        : null;
    if (belt) {
        belt.material.uniforms.uDiscs = discs;
        scene.add(belt.points);
    }
    // The stars and the belt keep off the record and the caption.
    for (const dots of [stars, belt]) {
        if (!dots) continue;
        dots.material.uniforms.uMask = mask;
        dots.material.uniforms.uKeep = keepOut;
        dots.material.uniforms.uKeepSoft = keepSoft;
    }

    /* ---- the ship --------------------------------------------------------- */

    // A small spacecraft along its velocity, banked to the Sun, with a
    // burn out of its engine only as a transfer begins.
    const craft = spacecraft();
    const ship = new Group();
    const nozzleGlow = radial(
        [
            [0, "rgba(235,242,255,1)"],
            [0.2, "rgba(210,225,255,0.45)"],
            [1, "rgba(200,220,255,0)"],
        ],
        64,
    );
    textures.push(nozzleGlow);
    const nozzle = new Sprite(
        new SpriteMaterial({
            map: nozzleGlow,
            blending: AdditiveBlending,
            depthWrite: false,
            transparent: true,
            toneMapped: false,
        }),
    );
    nozzle.scale.setScalar(0.55);
    nozzle.position.z = -0.42;
    ship.add(craft.craft, nozzle);
    scene.add(ship);

    /* ---- labels ----------------------------------------------------------- */

    // A world's label is its organisation's name alone: the card beside
    // the scene carries the dates.
    const makeLabel = (name: string) => {
        const el = document.createElement("div");
        el.className = hooks.classes.label;
        const b = document.createElement("b");
        b.className = hooks.classes.name;
        b.textContent = name;
        el.append(b);
        // The leader: a hairline from the world's limb to the label.
        const leader = document.createElement("i");
        leader.className = hooks.classes.leader;
        hooks.labels.append(leader, el);
        return { el, leader, w: 0, h: 0, state: "" };
    };
    const labels = data.chapters.map((c) => makeLabel(c.orgLabel));
    // A hollow ring on each world where it is only a few pixels wide.
    const rings = data.chapters.map(() => {
        const el = document.createElement("div");
        el.className = hooks.classes.world;
        hooks.labels.append(el);
        return el;
    });
    const openLabel = plan.planned ? makeLabel(hooks.openTo) : null;
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
    /** Draws every object (or the scene's part `only`, with the lights)
     *  once into a single pixel, none culled, so each program, texture and
     *  pipeline the GPU builds on first use is ready before its object
     *  first shows mid-scroll. */
    const drawOnce = (only?: Object3D) => {
        const kept: [Object3D, boolean, boolean][] = [];
        scene.traverse((o) => {
            kept.push([o, o.visible, o.frustumCulled]);
            o.visible = true;
            o.frustumCulled = false;
        });
        if (only)
            for (const part of scene.children)
                if (part !== only && !(part instanceof Light))
                    part.visible = false;
        renderer.setScissorTest(true);
        renderer.setScissor(0, 0, 1, 1);
        renderer.render(scene, camera);
        renderer.setScissorTest(false);
        for (const [o, visible, culled] of kept) {
            o.visible = visible;
            o.frustumCulled = culled;
        }
    };
    /** Warms every object: once the maps are in, and for each theme. */
    const warm = () => {
        if (!lost && !compiling) drawOnce();
    };
    /** The first programs, one part of the scene a task: each part's
     *  compiled (in parallel where the browser can,
     *  KHR_parallel_shader_compile), then each drawn once, so neither
     *  the mount nor the first frame does it all at once. Nothing is
     *  drawn meanwhile; after a few seconds the rest is left to the
     *  first frame. */
    let staging = false;
    const compileFirst = async () => {
        staging = true;
        const parts = scene.children.filter((part) => !(part instanceof Light));
        const turn = () => new Promise((resolve) => setTimeout(resolve));
        const compiled: Promise<unknown>[] = [];
        // Without the extension compileAsync only waits (and warns).
        const parallel = renderer.extensions.has("KHR_parallel_shader_compile");
        for (const part of parts) {
            await turn();
            if (disposed) return;
            if (lost) continue;
            if (parallel)
                compiled.push(renderer.compileAsync(part, camera, scene));
            else renderer.compile(part, camera, scene);
        }
        await Promise.race([
            Promise.all(compiled),
            new Promise((resolve) => setTimeout(resolve, 3000)),
        ]);
        for (const part of parts) {
            await turn();
            if (disposed) return;
            if (!lost) drawOnce(part);
        }
        compiling = false;
        if (last) draw(last);
        if (waited) reveal();
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

        // Void: the worlds as photographs, their highlights rolled off by
        // a neutral tone map (never the inks: lines, dots and the Sun set
        // toneMapped false). Flight Manual: a printed plate on the paper,
        // with no tone map, so the canvas's paper is the page's.
        renderer.toneMapping = light ? NoToneMapping : NeutralToneMapping;
        plate.uPrint.value = light ? 1 : 0;
        plate.uPaper.value.copy(bg);
        plate.uInk.value.copy(palette.ink1);
        ambient.intensity = light ? MANUAL_AMBIENT : 0.012;
        sunLight.intensity = light ? 3.1 : 2.9;

        // Void: a star, added to the black. Flight Manual: the printed ☉
        // in ink on paper, with no wash.
        sunMaterial.blending = light ? NormalBlending : AdditiveBlending;
        sunMaterial.uniforms.uPrint.value = light ? 1 : 0;
        sunMaterial.uniforms.uInk.value.copy(palette.ink1);

        // Void: the Milky Way and the stars, added to the black. Flight
        // Manual: no sky photograph; the brightest stars and the belt as
        // ink dots.
        const ink = palette.ink1.clone().convertLinearToSRGB();
        galaxy.mesh.visible = !light;
        if (!light && !skyMap)
            galaxy.material.uniforms.map.value = skyMap = load(maps.sky, false);
        for (const [dots, limit, alpha] of [
            [stars, 0.72, 0.5],
            [belt, 0, 0.32],
        ] as const) {
            if (!dots) continue;
            dots.material.blending = light ? NormalBlending : AdditiveBlending;
            dots.material.uniforms.uInk.value.copy(ink);
            dots.material.uniforms.uInkLimit.value = limit;
            dots.material.uniforms.uInkAlpha.value = alpha;
        }

        // Earth's air and city lights are light added to the black: none
        // on paper, where the clouds print as a paler screen.
        if (air) air.mesh.visible = !light;
        earthMaterial?.specular.copy(OCEAN_GLINT).multiplyScalar(light ? 0 : 1);
        if (cloudMaterial) cloudMaterial.opacity = light ? 0.55 : 1;

        // The craft: a light hull and slate wings in Void, each with a
        // floor of its own light so its night side still reads; ink on
        // paper. The burn: pale blue-white light, or an ink wedge.
        const dark = palette.ink3.clone().lerp(bg, light ? 0 : 0.55);
        craft.paint(palette.ink1, palette.ink2, light ? palette.ink1 : dark);
        craft.body.emissive
            .copy(light ? palette.ink1 : palette.ink3)
            .multiplyScalar(light ? 0.5 : 0.1);
        craft.wing.color.set(light ? palette.ink2 : new Color(WING_SLATE));
        craft.wing.emissive
            .copy(craft.wing.color)
            .multiplyScalar(light ? 0.4 : 0.14);
        craft.plume.blending = light ? NormalBlending : AdditiveBlending;
        craft.plume.uniforms.uColor.value.set(light ? palette.ink2 : PLUME);
        craft.plume.uniforms.uLevel.value = light ? 0.55 : 0.9;
        nozzle.visible = !light;
        for (const part of [past, ...parks.filter((r) => !r.accent)]) {
            part.material.color.copy(palette.ink2);
            part.material.opacity = light ? 0.9 : 0.8;
        }
        for (const part of [cur, ...parks.filter((r) => r.accent)]) {
            if (!part) continue;
            part.material.color.copy(palette.accent);
            part.material.opacity = 1;
        }
        if (plannedLeg) {
            plannedLeg.material.color.copy(palette.ink2);
            plannedLeg.material.opacity = 0.9;
        }
        if (plannedOrbit) {
            plannedOrbit.material.color.copy(palette.ink3);
            plannedOrbit.material.opacity = light ? 0.7 : 0.6;
        }
        // Every program for this theme (and its tone map), compiled now
        // rather than when its object first shows mid-scroll; the first
        // ones a part at a time (compileFirst).
        if (lost) return;
        if (compiling) {
            if (!staging) void compileFirst();
            return;
        }
        renderer.compile(scene, camera);
        warm();
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
    const sunV = new Vector3();
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
     * it.
     */
    const place = (
        label: ReturnType<typeof makeLabel>,
        at: { x: number; y: number; on: boolean },
        side: { x: number; y: number },
        gap: number,
        limb: number,
        alpha: number,
        state: string,
    ) => {
        const { el, leader } = label;
        const box = labelBox(at, side, gap, label);
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
     *  across where that is more than about 100° away. */
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
        const m = sides[i] ?? c;
        if (radial <= 0) return { side, reach: 1, fade };
        if (dotOf(side, m) > -0.2)
            return {
                side: turn(side, m, radial),
                reach: lerp(1, m.reach, radial),
                fade,
            };
        return radial < 0.5
            ? {
                  side,
                  reach: 1,
                  fade: fade * (1 - smoothstep(0.1, 0.5, radial)),
              }
            : {
                  side: m,
                  reach: m.reach,
                  fade: fade * smoothstep(0.5, 0.9, radial),
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
        if (disposed || lost) return;
        const { p, t, card } = frame;
        const kind = frame.segment.kind;
        const pose = plan.pose(frame, stage);
        view = pose;
        plate.uOpen.value = pose.open;

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
        sky.position.copy(camera.position);

        // No world is drawn under a few pixels in radius (Saturn with its
        // ring), so the map shows worlds, not empty rings.
        const minPx = minWorldPx(stage);
        for (const b of bodies) {
            b.globe.rotation.y = plan.spinAt(b.w, p);
            const depth = eyeV
                .copy(b.tilt.position)
                .sub(camera.position)
                .dot(forward);
            b.px = (b.w.radius * stage.kpx) / Math.max(1e-3, depth);
            b.drawn = Math.max(b.px, minPx);
            b.tilt.scale.setScalar(depth > 0 ? b.drawn / b.px : 1);
            // The sunrise is Earth's alone: the other worlds show once the
            // camera has risen into the chase (they are behind it then).
            b.tilt.visible = pose.open === 0 || b.w.kind === "earth";
        }
        // Earth's clouds turn a little faster than its ground; its air
        // and Saturn's ring shadows follow their worlds as drawn.
        const earthBody = bodies.find((b) => b.w.kind === "earth");
        if (earthBody && clouds && air) {
            clouds.rotation.y = earthBody.globe.rotation.y * 1.08 + 0.35;
            air.centre.copy(earthBody.tilt.position);
        }
        for (const b of bodies) {
            if (b.w.kind !== "saturn") continue;
            const size = b.w.radius * b.tilt.scale.x;
            for (const { shadow, radius } of ringShadows) {
                shadow.centre.value.copy(b.tilt.position);
                shadow.radii.value = [size * RING.inner, size * RING.outer];
                radius.value = size;
            }
        }
        if (belt) belt.material.uniforms.uLevel.value = 1 - pose.open;
        // The Milky Way sits back in the map, so the route leads, and dips
        // while the camera cranes (SKY_CRANE_DIP).
        galaxy.material.uniforms.uGain.value =
            SKY_GAIN *
            (1 -
                SKY_MAP_DIM * pose.overview -
                SKY_CRANE_DIP * Math.sin(Math.PI * pose.overview) ** 2);
        // The Moon beside Earth, while it is a disc at all.
        if (moon && plan.moon && earthBody) {
            moon.position.set(...plan.moon.at(t));
            moon.lookAt(earthBody.tilt.position);
            moon.rotateY(-Math.PI / 2);
            const depth = eyeV
                .copy(moon.position)
                .sub(camera.position)
                .dot(forward);
            moon.visible =
                (plan.moon.radius * stage.kpx) / Math.max(1e-3, depth) > 1.2;
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
            let Rmax = Math.min(0.35 * H, 8 * R, 90);
            let halo = 0.35 * R;
            // At the sunrise: a small core in a wide glow, rising over the
            // limb (it has left the frame before the chase takes over).
            const rise = smoothstep(0, 0.05, pose.open);
            R = lerp(R, SUNRISE.core, rise);
            Rmax = lerp(Rmax, SUNRISE.reach * H, rise);
            halo = lerp(halo, SUNRISE.halo, rise);
            u.uHalo.value = halo;
            // Flight Manual prints the ☉ just clear of the drawn limb.
            u.uLift.value = palette.light ? SUN_LIFT * rise : 0;
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
            // At the sunrise the orbits (seen edge-on) are not yet drawn.
            o.material.opacity =
                lerp(visited ? seen : future, bright, held) * (1 - pose.open);
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
                (palette.light ? 0.7 : 0.6) *
                (0.45 + 0.55 * pose.overview) *
                (1 - pose.open);
            // Fine, even dashes on screen at any distance.
            const px = reach / stage.kpx;
            plannedOrbit.material.dashSize = 3 * px;
            plannedOrbit.material.gapSize = 5 * px;
        }

        // The ship: along its velocity, banked to turn its wings to the
        // Sun, a set span on screen. Through a transfer's fly-to it narrows
        // (the worlds are small there); through the crane it shrinks, then
        // hands over to the now mark, which has come in first: one of them
        // is always on screen.
        const ship3 = plan.shipAt(p);
        const ahead = plan.shipAt(Math.min(1, p + 0.0006));
        const behind = plan.shipAt(Math.max(0, p - 0.0006));
        ship.position.set(...ship3);
        v.set(ahead[0] - behind[0], ahead[1] - behind[1], ahead[2] - behind[2]);
        if (v.lengthSq() > 1e-10) {
            v.normalize();
            ship.lookAt(eyeV.copy(v).add(ship.position));
            const side = eyeV.set(1, 0, 0).applyQuaternion(ship.quaternion);
            const sunward = side.dot(
                sunV.copy(ship.position).negate().normalize(),
            );
            ship.rotateZ(BANK * Math.max(-1, Math.min(1, -4 * sunward)));
        }
        const shipDepth = Math.max(
            0.1,
            eyeV.copy(ship.position).sub(camera.position).dot(forward),
        );
        const span = wideLayout
            ? Math.min(
                  SHIP_SPAN.max,
                  Math.max(SHIP_SPAN.min, SHIP_SPAN.share * H),
              )
            : SHIP_SPAN.phone;
        const shipScale =
            (span *
                (1 - SHIP_SPAN.fly * pose.fly) *
                (1 - 0.4 * pose.overview) *
                shipDepth) /
            stage.kpx /
            craft.span;
        ship.scale.setScalar(shipScale);
        const shipFade = 1 - smoothstep(0.6, 0.8, pose.overview);
        craft.body.opacity = shipFade;
        craft.wing.opacity = shipFade;
        ship.visible = shipFade > 0.001;
        // The departure burn: only as a transfer begins, a pure function
        // of its progress (no flicker), so scrubbing back retraces it.
        const burn =
            kind === "transfer"
                ? smoothstep(0, 0.03, frame.u) *
                  (1 - smoothstep(0.12, 0.2, frame.u))
                : 0;
        craft.plume.uniforms.uEnv.value = burn * shipFade;
        craft.flame.scale.z = 0.5 + 1.5 * burn;
        craft.flame.visible = burn > 0.001;
        nozzle.visible = !palette.light && burn > 0.001;
        nozzle.material.opacity = 0.8 * burn * shipFade;

        // The trail to the ship's engine; the planned leg draws out in the
        // plan. Older legs sit back, less so in the map, where the whole
        // story reads.
        age.value.set(
            Math.min(p, flown),
            fadeLen,
            lerp(0.35, 0.6, pose.overview),
        );
        const nozzleAt: Vec3 = [
            ship3[0] - v.x * 0.37 * shipScale,
            ship3[1] - v.y * 0.37 * shipScale,
            ship3[2] - v.z * 0.37 * shipScale,
        ];
        // On the track the line runs to the nozzle; on a ring the track
        // waits at its touch point while the ring draws.
        const ringNow = plan.ringOf(p);
        const onTrack = ringNow < 0 && p < flown;
        const n = reached(track.ps, p);
        const drawn = onTrack ? n : n - 1;
        const head = onTrack ? nozzleAt : null;
        if (drawn <= iCur) {
            drawTo(past, drawn, head);
            if (cur) drawTo(cur, 0, null);
        } else {
            drawTo(past, iCur, null);
            if (cur) drawTo(cur, drawn - iCur, head);
        }
        for (const ring of parks) {
            const k = reached(ring.ps, p);
            const on = ringNow === ring.world && k < ring.ps.length;
            drawTo(ring, on ? k : k - 1, on ? nozzleAt : null);
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

        // Labels: only in the finale's map (and a still flight's), where
        // it has the room to name every world (mapNamesAll). At a hold the
        // card's organisation and the lit rail stop name the world, so the
        // scene is unlabelled while held; a phone, or a narrow window
        // beside the record, names none.
        const named = kind === "plan" && mapNamesAll(stage);
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
            // The labels come in as the map settles, not as their worlds
            // sweep in through the crane; each is gone once its world
            // leaves the safe area.
            const alpha =
                named && state !== "future"
                    ? smoothstep(0.4, 0.6, frame.u) *
                      (1 - smoothstep(-16, 8, overflow(pointBox(at))))
                    : 0;
            // A hairline ring round a world drawn at its smallest; in the
            // map a world with a parking ring needs none.
            const small =
                (1 - smoothstep(3, 7, b.px)) * (looped[i] ? 1 - radial : 1);
            if (alpha * small > 0.01)
                rings[i].style.setProperty(
                    "--d",
                    `${(2 * b.drawn + 7).toFixed(1)}px`,
                );
            mark(rings[i], at, alpha * small);
            const { side, reach, fade } = sideAt(i, frame, radial);
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
                    ? plan.flownGap(i, pose, stage, positions[i], side, label) *
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
            );
        });
        if (openLabel && plan.planned) {
            const at = project(plan.planned.end);
            // The planned orbit's end and its label come in as the leg
            // reaches them.
            const on = kind === "plan" ? smoothstep(0.78, 0.9, frame.u) : 0;
            place(openLabel, at, away(at), 12, 12, named ? on : 0, "plan");
            mark(targetMark, at, on);
        }
        const shipAt = project(ship3);
        mark(
            nowMark,
            shipAt,
            kind === "plan" ? smoothstep(0.45, 0.65, pose.overview) : 0,
        );

        if (!compiling) renderer.render(scene, camera);
    }

    /** The last layout, as a key: a resize that changes none of it
     *  (a phone's toolbar coming and going resizes the window, not the
     *  stage) re-makes nothing and draws nothing. */
    let laidOut = "";
    let sizeArgs: Parameters<FlightGL["resize"]> | null = null;
    function resize(...args: Parameters<FlightGL["resize"]>) {
        const [width, height, wide, record, caption, column] = args;
        // A hidden page has no stage to draw on: keep what is drawn.
        if (!(width >= 1 && height >= 1)) return;
        sizeArgs = args;
        const device = window.devicePixelRatio || 1;
        const dpr = drawingRatio(width, height, wide, device);
        const key = [
            width,
            height,
            dpr,
            device,
            wide,
            record,
            caption && [caption.x0, caption.y0, caption.x1, caption.y1],
            column,
            // The labels are measured again once the fonts are in.
            document.fonts?.status,
        ].join();
        if (key === laidOut) return;
        laidOut = key;
        // One allocation, and only when the drawing buffer changes.
        if (width !== W || height !== H || dpr !== renderer.getPixelRatio())
            renderer.setDrawingBufferSize(width, height, dpr);
        W = width;
        H = height;
        wideLayout = wide;
        cssDpr = device;
        stage = stageFrame(W, H, wide, column);
        camera.aspect = W / H;
        camera.fov = stage.fov;
        for (const m of lineMaterials) m.resolution.set(W, H);
        // The sky fades in below the stage's top edge.
        const feather = [H * dpr, SKY_FEATHER * dpr] as const;
        galaxy.material.uniforms.uFeather.value.set(...feather);
        stars.material.uniforms.uFeather.value.set(...feather);
        for (const dots of [stars, belt])
            if (dots) dots.material.uniforms.uDpr.value = dpr;
        if (belt) belt.material.uniforms.uDiscClear.value = BELT_CLEAR * dpr;
        // No line under the record: on a wide stage they fade out
        // under its scrim; on a phone above its top edge.
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
        if (wide) {
            const [from, to] = lineMask(stage);
            mask.value.set(from * dpr, to * dpr, -2, -1);
            // The scrim holds the record's column and clears past the
            // room beside it: at 1440 from 24% to 58% of the width.
            hooks.scrim.style.setProperty(
                "--scrim-a",
                `${(stage.record - 0.104 * W).toFixed(1)}px`,
            );
            hooks.scrim.style.setProperty(
                "--scrim-b",
                `${(stage.clear + 0.12 * W).toFixed(1)}px`,
            );
        } else {
            mask.value.set(-2, -1, (H - top + 6) * dpr, (H - top + 28) * dpr);
            hooks.scrim.style.removeProperty("--scrim-a");
            hooks.scrim.style.removeProperty("--scrim-b");
        }
        measureLabels();
        room = inset(safe, LABEL_FADE);
        sides = plan.mapSides(stage, labels, wide ? openLabel : null, safe);
        chase = plan.chaseSides(stage, labels, safe, wide ? sides : undefined);
        if (last) draw(last);
    }
    // The device pixel ratio changes without a resize when the window
    // moves to another screen: watched for the ratio in use.
    let ratioQuery: MediaQueryList | null = null;
    const watchRatio = () => {
        ratioQuery?.removeEventListener("change", onRatio);
        ratioQuery = window.matchMedia(
            `(resolution: ${window.devicePixelRatio || 1}dppx)`,
        );
        ratioQuery.addEventListener("change", onRatio);
    };
    function onRatio() {
        watchRatio();
        if (sizeArgs) resize(...sizeArgs);
    }
    watchRatio();

    // A lost context (a GPU reset, or a phone reclaiming a background
    // tab's) hides the canvas and the labels, and the poster shows. On its
    // return three.js makes its objects again; the theme's colours, the
    // programs and the maps follow, and the last frame is drawn without a
    // scroll.
    const onLost = (event: Event) => {
        event.preventDefault();
        if (disposed) return;
        lost = everLost = true;
        hooks.lost();
    };
    const onRestored = () => {
        if (disposed) return;
        lost = false;
        applyTheme();
        if (last) draw(last);
        if (revealed) hooks.ready();
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    return {
        resize,
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
            cancelAnimationFrame(uploadFrame);
            themeWatch.disconnect();
            ratioQuery?.removeEventListener("change", onRatio);
            canvas.removeEventListener("webglcontextlost", onLost);
            canvas.removeEventListener("webglcontextrestored", onRestored);
            // After a loss, three.js's objects from before it belong to a
            // context that is gone (deleting them only logs errors); losing
            // the context below frees everything the GPU holds anyway.
            if (!everLost) {
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
            }
            for (const t of textures)
                if (t.image instanceof ImageBitmap) t.image.close();
            if (!renderer.getContext().isContextLost())
                renderer.forceContextLoss();
            canvas.remove();
            hooks.labels.replaceChildren();
        },
    };
}
