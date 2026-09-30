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
    Vector3,
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
    RING,
    buildFlight,
    onPlane,
    screenOf,
    smoothstep,
    stageFrame,
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
    resize(width: number, height: number, wide: boolean): void;
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
/** No world is drawn smaller than this radius, pixels (wide, phones). */
const MIN_PX = 6;
const MIN_PX_PHONE = 5;

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
    vec3 c = vec3(1.0, 0.975, 0.94) * 2.6 * limb * disc
        + vec3(1.0, 0.94, 0.86) * corona * (1.0 - disc);
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

    const makeLine = (
        points: Vec3[],
        width: number,
        dashed = false,
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

    const orbits = plan.worlds.map((w) => makeLine(ring(w.orbit, w.plane), 1));
    const plannedOrbit = plan.planned
        ? makeLine(ring(plan.planned.orbit, plan.planned.plane, 512), 1, true)
        : null;
    const plannedLeg = plan.planned
        ? makeLine(plan.planned.path, 1.4, true)
        : null;

    // The trail: flown in ink, the current leg in the accent. Each is drawn
    // to the sample before the ship, then one segment to the ship itself.
    const samples = plan.trail(TRAIL_SAMPLES);
    const flown = route.flown || 1;
    const iCur =
        plan.current < 0
            ? TRAIL_SAMPLES - 1
            : Math.round((plan.currentFrom / flown) * (TRAIL_SAMPLES - 1));
    const past = makeLine(samples.slice(0, iCur + 1), 1.4);
    const cur =
        iCur < TRAIL_SAMPLES - 1 ? makeLine(samples.slice(iCur), 2) : null;
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
        hooks.labels.append(el);
        return { el, w: 0, h: 0 };
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
        return {
            x: s.x,
            y: s.y,
            depth: s.depth,
            on:
                s.depth > camera.near &&
                s.x > -0.1 * W &&
                s.x < 1.1 * W &&
                s.y > -0.1 * H &&
                s.y < 1.1 * H,
        };
    };
    const minLabelX = () => (wideLayout ? W * 0.37 : 8);
    /**
     * A label beside its world: on the chase to the right (away from the
     * record), unless it would leave the stage; in the overview outward
     * from the Sun, clear of the orbits inside. `radial` blends the two.
     */
    const place = (
        label: { el: HTMLElement; w: number; h: number },
        at: { x: number; y: number },
        gap: number,
        alpha: number,
        state: string,
        radial: number,
        sun: { x: number; y: number },
        avoid: { x: number; y: number; on: boolean } | null = null,
    ) => {
        const { el, w, h } = label;
        el.style.opacity = alpha > 0.01 ? alpha.toFixed(3) : "0";
        el.dataset.state = state;
        if (alpha <= 0.01) return;
        let left = !wideLayout && at.x > stage.lens.x + 4;
        if (!left && at.x + gap + w > W - 12) left = true;
        else if (left && at.x - gap - w < minLabelX()) left = false;
        let x = left ? at.x - gap - w : at.x + gap;
        let y = at.y - h / 2;
        let align = left ? "right" : "left";
        // A large world on a narrow stage leaves no room either side: the
        // label goes under it instead of over it.
        if (at.x - gap - w < minLabelX() && at.x + gap + w > W - 12) {
            x = at.x - w / 2;
            y = at.y + gap;
            align = "center";
        }
        if (radial > 0) {
            let vx = at.x - sun.x;
            let vy = at.y - sun.y;
            const n = Math.hypot(vx, vy) || 1;
            vx /= n;
            vy /= n;
            const rx = at.x + vx * gap + (-0.5 + 0.5 * vx) * w;
            const ry = at.y + vy * gap + (-0.5 + 0.5 * vy) * h;
            x += (rx - x) * radial;
            y += (ry - y) * radial;
            if (radial > 0.5)
                align =
                    Math.abs(vx) < 0.45 ? "center" : vx < 0 ? "right" : "left";
        }
        x = Math.min(W - 12 - w, Math.max(minLabelX(), x));
        // Step off the ship rather than print over it.
        if (
            avoid?.on &&
            avoid.x > x - 10 &&
            avoid.x < x + w + 10 &&
            avoid.y > y - 10 &&
            avoid.y < y + h + 10
        ) {
            const up = avoid.y - 12 - h;
            const down = avoid.y + 12;
            y = Math.abs(up - y) < Math.abs(down - y) ? up : down;
        }
        y = Math.min(H - 8 - h, Math.max(8, y));
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        el.style.textAlign = align;
    };
    const mark = (
        el: HTMLElement,
        at: { x: number; y: number; on: boolean },
        alpha: number,
    ) => {
        const a = at.on ? alpha : 0;
        el.style.opacity = a > 0.01 ? String(a) : "0";
        if (a > 0.01)
            el.style.transform = `translate3d(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px, 0)`;
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
        const minPx = wideLayout ? MIN_PX : MIN_PX_PHONE;
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
        // steps in; in the map it is fainter and the core at most 6px.
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

        // Orbits: visited in ink-2, the current one brighter, future dim.
        orbits.forEach((o, i) => {
            const isCur = i === card;
            const visited = p >= coastStart[i] - 1e-6;
            o.material.color.copy(
                isCur ? palette.ink1 : visited ? palette.ink2 : palette.ink3,
            );
            o.material.opacity = palette.light
                ? isCur
                    ? 0.85
                    : visited
                      ? 0.6
                      : 0.38
                : isCur
                  ? 0.62
                  : visited
                    ? 0.42
                    : 0.2;
        });
        if (plannedOrbit) {
            plannedOrbit.material.opacity =
                (palette.light ? 0.7 : 0.6) * (0.45 + 0.55 * pose.overview);
            // Fine, even dashes on screen at any distance.
            const px = reach / stage.kpx;
            plannedOrbit.material.dashSize = 3 * px;
            plannedOrbit.material.gapSize = 5 * px;
        }

        // The trail to the ship; the planned leg draws out in the plan.
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

        // Labels: the worlds flown and the one approached; on phones only
        // the current world.
        const seg = frame.segment;
        const world = Math.min(card, labels.length - 1);
        const radial = smoothstep(0.35, 0.85, pose.overview);
        const sun = sunAt;
        const shipOnScreen = ship.visible ? project(ship3) : null;
        labels.forEach((label, i) => {
            const b = bodies[i];
            const at = project(b.tilt.position.toArray() as Vec3);
            let alpha = 0;
            let state = "future";
            if (i === card) state = "current";
            else if (p >= coastStart[i] - 1e-6) state = "visited";
            if (state !== "future") alpha = 1;
            else if (seg.kind === "transfer" && seg.chapter === i)
                alpha = smoothstep(0.1, 0.6, frame.u) * 0.85;
            if (!wideLayout && i !== world) alpha = 0;
            if (!at.on) alpha = 0;
            const gap = b.drawn;
            const ringGap = b.w.kind === "saturn" ? gap * RING.outer : gap;
            // In the overview a label also clears the world's parking loop.
            const loopGap =
                (b.w.park * stage.kpx * radial) / Math.max(0.1, at.depth);
            // A hairline ring round a world drawn at its smallest.
            const small = 1 - smoothstep(3, 7, b.px);
            if (alpha * small > 0.01)
                rings[i].style.setProperty(
                    "--d",
                    `${(2 * gap + 7).toFixed(1)}px`,
                );
            mark(rings[i], at, alpha * small);
            place(
                label,
                at,
                Math.min(W * 0.3, Math.max(ringGap, loopGap, 6 * small)) + 9,
                alpha,
                state,
                radial,
                sun,
                shipOnScreen,
            );
        });
        if (openLabel && plan.planned) {
            const at = project(plan.planned.end);
            // The planned orbit's end and its label come in as the leg
            // reaches them.
            const on = kind === "plan" ? smoothstep(0.78, 0.9, frame.u) : 0;
            place(
                openLabel,
                at,
                12,
                at.on && wideLayout ? on : 0,
                "plan",
                radial,
                sun,
            );
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
        resize(width, height, wide) {
            W = Math.max(1, width);
            H = Math.max(1, height);
            wideLayout = wide;
            renderer.setPixelRatio(
                Math.min(MAX_DPR, window.devicePixelRatio || 1),
            );
            renderer.setSize(W, H, false);
            stage = stageFrame(W, H, wide);
            camera.aspect = W / H;
            camera.fov = stage.fov;
            for (const m of lineMaterials) m.resolution.set(W, H);
            measureLabels();
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
