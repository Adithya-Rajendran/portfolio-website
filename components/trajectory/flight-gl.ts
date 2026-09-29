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
    RING,
    buildFlight,
    onPlane,
    smoothstep,
    type Layout,
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
    let layout: Layout = { kpx: 1, halfW: 1, halfH: 1 };
    let lens = { x: 0, y: 0 };
    let wideLayout = true;

    /* ---- light, Sun and stars ------------------------------------------ */

    const sunLight = new PointLight(0xffffff, 3.3, 0, 0);
    const ambient = new AmbientLight(0xffffff, 0.12);
    scene.add(sunLight, ambient);

    const sunCore = new Mesh(
        new SphereGeometry(1.5, 48, 24),
        new MeshBasicMaterial({ color: 0xfff6ea }),
    );
    const glowTexture = radial([
        [0, "rgba(255,253,248,1)"],
        [0.06, "rgba(255,248,236,0.92)"],
        [0.16, "rgba(255,238,218,0.36)"],
        [0.34, "rgba(255,232,210,0.1)"],
        [0.6, "rgba(255,230,210,0.025)"],
        [1, "rgba(255,230,210,0)"],
    ]);
    textures.push(glowTexture);
    const glow = new Sprite(
        new SpriteMaterial({
            map: glowTexture,
            blending: AdditiveBlending,
            depthWrite: false,
            transparent: true,
        }),
    );
    glow.scale.setScalar(24);
    const halo = new Sprite(
        new SpriteMaterial({
            map: glowTexture,
            blending: AdditiveBlending,
            depthWrite: false,
            transparent: true,
            opacity: 0.22,
        }),
    );
    halo.scale.setScalar(64);
    scene.add(sunCore, halo, glow);

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
        return { w, tilt, globe };
    });

    /* ---- the ship --------------------------------------------------------- */

    const ship = new Group();
    const hull = new ConeGeometry(0.26, 1, 20, 1);
    hull.rotateX(Math.PI / 2);
    const shipMaterial = new MeshLambertMaterial({ color: 0xffffff });
    const shipMesh = new Mesh(hull, shipMaterial);
    ship.add(shipMesh);
    const beacon = new Sprite(
        new SpriteMaterial({
            map: glowTexture,
            blending: AdditiveBlending,
            depthWrite: false,
            transparent: true,
            opacity: 0.55,
        }),
    );
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

        // Void: a white-hot Sun with an additive glow. Flight Manual: paper,
        // so the glow becomes a faint ink wash and the worlds a little
        // brighter on their night side, like a printed plate.
        const glowMat = glow.material as SpriteMaterial;
        const haloMat = halo.material as SpriteMaterial;
        glowMat.blending = light ? NormalBlending : AdditiveBlending;
        haloMat.blending = light ? NormalBlending : AdditiveBlending;
        glowMat.color.set(light ? palette.ink3 : 0xffffff);
        haloMat.color.set(light ? palette.ink3 : 0xffffff);
        glowMat.opacity = light ? 0.5 : 1;
        haloMat.opacity = light ? 0 : 0.16;
        halo.visible = !light;
        beacon.visible = !light;
        glowMat.needsUpdate = haloMat.needsUpdate = true;
        // On paper the Sun is the paper itself, ringed by its ink wash.
        (sunCore.material as MeshBasicMaterial).color.set(
            light ? bg : 0xfff6ea,
        );
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
    const coastStart = plan.worlds.map(
        (w) =>
            route.segments.find(
                (s) =>
                    s.chapter === w.chapter &&
                    (s.kind === "coast" || s.kind === "flyby"),
            )?.p0 ?? 0,
    );

    const project = (p: Vec3) => {
        v.set(p[0], p[1], p[2]).project(camera);
        const depth = eyeV
            .set(p[0], p[1], p[2])
            .sub(camera.position)
            .dot(forward);
        return {
            x: (v.x + 1) * 0.5 * W,
            y: (1 - v.y) * 0.5 * H,
            depth,
            on:
                depth > camera.near &&
                v.x > -1.2 &&
                v.x < 1.2 &&
                v.y > -1.2 &&
                v.y < 1.2,
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
        let left = !wideLayout && at.x > lens.x + 4;
        if (!left && at.x + gap + w > W - 12) left = true;
        else if (left && at.x - gap - w < minLabelX()) left = false;
        let x = left ? at.x - gap - w : at.x + gap;
        let y = at.y - h / 2;
        let align = left ? "right" : "left";
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
        const pose = plan.pose(frame, layout);

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
        pm[8] = -((2 * lens.x) / W - 1);
        pm[9] = -(1 - (2 * lens.y) / H);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
        camera.updateMatrixWorld();
        camera.getWorldDirection(forward);
        stars.position.copy(camera.position);

        // Worlds at mission time t.
        for (const b of bodies) {
            const at = plan.worldAt(b.w, t);
            b.tilt.position.set(...at);
            b.globe.rotation.y = plan.spinAt(b.w, p);
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
            const px = reach / layout.kpx;
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
        let planOn = 0;
        if (plannedLeg && plan.planned) {
            planOn = kind === "plan" ? smoothstep(0.18, 0.72, frame.u) : 0;
            const n = plan.planned.path.length - 1;
            drawTo(plannedLeg, Math.round(planOn * n), null);
            const px = reach / layout.kpx;
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
        ship.scale.setScalar((SHIP_PX * shipDepth) / layout.kpx);
        ship.visible = pose.overview < 0.55;

        // Labels: the worlds flown and the one approached; on phones only
        // the current world.
        const seg = frame.segment;
        const world = Math.min(card, labels.length - 1);
        const radial = smoothstep(0.35, 0.85, pose.overview);
        const sun = project([0, 0, 0]);
        const shipOnScreen = ship.visible ? project(ship3) : null;
        labels.forEach((label, i) => {
            const b = bodies[i];
            const at = project(plan.worldAt(b.w, t));
            let alpha = 0;
            let state = "future";
            if (i === card) state = "current";
            else if (p >= coastStart[i] - 1e-6) state = "visited";
            if (state !== "future") alpha = 1;
            else if (seg.kind === "transfer" && seg.chapter === i)
                alpha = smoothstep(0.1, 0.6, frame.u) * 0.85;
            if (!wideLayout && i !== world) alpha = 0;
            if (!at.on) alpha = 0;
            const gap = (b.w.radius * layout.kpx) / Math.max(0.1, at.depth);
            const ringGap = b.w.kind === "saturn" ? gap * RING.outer : gap;
            // In the overview a label also clears the world's parking loop.
            const loopGap =
                (b.w.park * layout.kpx * radial) / Math.max(0.1, at.depth);
            const small = 1 - smoothstep(3, 7, gap);
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
            const a =
                at.on && wideLayout
                    ? smoothstep(0.62, 0.85, frame.u) *
                      (kind === "plan" ? 1 : 0)
                    : 0;
            place(openLabel, at, 12, a, "plan", radial, sun);
            mark(
                targetMark,
                at,
                kind === "plan" ? smoothstep(0.62, 0.85, frame.u) : 0,
            );
        }
        const shipAt = project(ship3);
        mark(
            nowMark,
            shipAt,
            kind === "plan" ? smoothstep(0.35, 0.6, pose.overview) : 0,
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
            camera.aspect = W / H;
            camera.fov = wide ? 38 : 44;
            const kpx = H / 2 / Math.tan((camera.fov * Math.PI) / 360);
            if (wide) {
                lens = { x: W * 0.65, y: H * 0.5 };
                layout = {
                    kpx,
                    halfW: Math.min(W - lens.x - 44, W * 0.3),
                    halfH: H * 0.41,
                };
            } else {
                lens = { x: W * 0.5, y: H * 0.29 };
                layout = { kpx, halfW: W * 0.46, halfH: H * 0.25 };
            }
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
