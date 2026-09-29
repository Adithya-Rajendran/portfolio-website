import { starLayout } from "@/lib/sky/stars";
import images from "@/lib/trajectory-images.json";
import type { Frame, Route, TrajectoryData } from "@/lib/trajectory";
import type { Scene } from "./journey";
import {
    burnAt,
    buildGeometry,
    cameraAt,
    centreAt,
    cubic,
    headingOn,
    ORBIT_ROLL,
    smooth,
    shipOn,
    type BodyName,
    type Geometry,
    type Vec,
    type World,
} from "./voyage-path";
import styles from "./voyage.module.css";

/**
 * Option B, the voyage: the career as a horizontal flight along time.
 * Scroll moves a camera right along the time axis while the ship holds
 * near one spot on screen and the worlds pan under it, in three depths:
 * a NASA photograph far back (Void only), a seeded starfield, and the
 * worlds, trail and labels. The ruler along the bottom is the axis itself.
 * `render` draws from the frame alone, so scrubbing backwards is exact;
 * sizes and the route's geometry are worked out in `resize`.
 */

type Manifest = Record<
    string,
    {
        src: string;
        width: number;
        height: number;
        body?: { cx: number; cy: number; rx: number; ry: number };
        rings?: { cx: number; cy: number; rx: number; ry: number };
    }
>;
const IMAGES = images as Manifest;

const DPR_CAP = 2;
const STAR_SEED = 2019;
const SVG = "http://www.w3.org/2000/svg";
/** Parallax rates: the stars move at this share of the worlds' speed. */
const STAR_RATE = 0.22;
let uid = 0;

interface Palette {
    bg: string;
    ink1: string;
    ink2: string;
    ink3: string;
    rule2: string;
    accent: string;
    star: string;
    manual: boolean;
}

function readPalette(): Palette {
    const root = document.documentElement;
    const css = getComputedStyle(root);
    const get = (name: string, fallback: string) =>
        css.getPropertyValue(name).trim() || fallback;
    return {
        bg: get("--bg", "#050507"),
        ink1: get("--ink-1", "#ece8df"),
        ink2: get("--ink-2", "#bcb7ad"),
        ink3: get("--ink-3", "#8f8a80"),
        rule2: get("--rule-2", "#67635c"),
        accent: get("--accent", "#ff5a1f"),
        star: get("--star-rgb", "236 232 223"),
        manual: root.dataset.theme === "manual",
    };
}

/** "#rrggbb" or "#rgb" with an alpha, for gradients. */
function alpha(color: string, a: number): string {
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
    if (!hex) return color;
    let h = hex[1];
    if (h.length === 3) h = [...h].map((c) => c + c).join("");
    const n = parseInt(h, 16);
    return `rgb(${n >> 16} ${(n >> 8) & 255} ${n & 255} / ${a})`;
}

const el = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
};

const svg = (tag: string, attrs: Record<string, string | number>) => {
    const node = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    return node;
};

export default function createVoyage(
    host: HTMLElement,
    data: TrajectoryData,
    route: Route,
): Scene {
    host.classList.add(styles.host);
    const n = data.chapters.length;

    /* ---- the layers --------------------------------------------------- */
    const backdrop = el("div", styles.backdrop);
    const photo = el("img", styles.photo);
    photo.alt = "";
    photo.decoding = "async";
    backdrop.append(photo);

    const canvas = el("canvas", styles.canvas);
    const ctx = canvas.getContext("2d")!;
    const tile = document.createElement("canvas");

    const labelLayer = el("div", styles.labels);
    const labels = data.chapters.map((chapter, i) => {
        const node = el("div", styles.label);
        const org = el("span", styles.org);
        org.textContent = chapter.orgLabel;
        node.append(org);
        if (chapter.dates) {
            const dates = el("span", styles.dates);
            dates.textContent = chapter.dates;
            node.append(dates);
        }
        node.dataset.index = String(i);
        labelLayer.append(node);
        return node;
    });
    const tickNodes: HTMLElement[] = [];

    const veil = el("div", styles.veil);
    const ruler = el("div", styles.ruler);
    const track = svg("svg", { class: styles.track }) as SVGSVGElement;
    const playhead = el("div", styles.playhead);
    ruler.append(track, playhead);
    host.append(backdrop, canvas, labelLayer, veil, ruler);

    /* ---- images, loaded after the first frame ------------------------ */
    const bodies = new Map<BodyName, HTMLImageElement>();
    // Each photograph resampled once to its size on screen, so a frame
    // copies pixels instead of scaling a large image every time.
    const sprites = new Map<BodyName, HTMLCanvasElement>();
    let lastFrame: Frame | null = null;
    let spans: SVGElement[] = [];
    let spanOn = -1;
    let disposed = false;
    const redraw = () => {
        if (!disposed && lastFrame) render(lastFrame);
    };
    const load = (name: BodyName) => {
        if (bodies.has(name)) return;
        const img = new Image();
        img.decoding = "async";
        img.onload = redraw;
        img.src = IMAGES[name].src;
        bodies.set(name, img);
    };
    const loadPhoto = () => {
        if (photo.getAttribute("src")) return;
        photo.onload = () => {
            if (!disposed) photo.dataset.loaded = "";
        };
        photo.src = IMAGES.backdrop.src;
    };

    /* ---- state from resize -------------------------------------------- */
    let palette = readPalette();
    let W = 0;
    let H = 0;
    let wide = true;
    let dpr = 1;
    let ax = 0;
    let ay = 0;
    let lead = 0;
    let planTarget = 0;
    let rulerY = 0;
    let g: Geometry | null = null;
    let photoBox = { w: 0, h: 0, span: 1 };
    let labelSize: { w: number; h: number }[] = [];
    let tickSize: { w: number; h: number }[] = [];
    // The trail, sampled once per layout: world points, the route
    // progress at each, and flags (1: behind its planet, 2: current leg).
    let trail = {
        x: new Float32Array(0),
        y: new Float32Array(0),
        p: new Float32Array(0),
        f: new Uint8Array(0),
    };
    let planPoints: Vec[] = [];

    const X = (t: number) => (g ? (t - g.t0) * g.ppy : 0);
    const imageOf = (w: World) => (w.body ? IMAGES[w.body] : null);
    const bodyRy = (w: World) => {
        const info = imageOf(w);
        if (!info?.body) return w.r;
        return (
            (w.r * (info.body.ry * info.height)) / (info.body.rx * info.width)
        );
    };

    function sample() {
        if (!g) return;
        const xs: number[] = [];
        const ys: number[] = [];
        const ps: number[] = [];
        const fs: number[] = [];
        route.segments.forEach((segment, index) => {
            if (segment.kind === "plan") return;
            let len = 0;
            let prev = shipOn(g!, segment, 0, index);
            for (let k = 1; k <= 24; k++) {
                const q = shipOn(g!, segment, k / 24, index);
                len += Math.hypot(q.x - prev.x, q.y - prev.y);
                prev = q;
            }
            const count = Math.min(1400, Math.max(12, Math.ceil(len / 2.5)));
            const current = segment.chapter === g!.current ? 2 : 0;
            for (let k = 0; k <= count; k++) {
                if (k === 0 && xs.length) continue;
                const u = k / count;
                const q = shipOn(g!, segment, u, index);
                xs.push(q.x);
                ys.push(q.y);
                ps.push(segment.p0 + (segment.p1 - segment.p0) * u);
                fs.push((q.back ? 1 : 0) | current);
            }
        });
        trail = {
            x: Float32Array.from(xs),
            y: Float32Array.from(ys),
            p: Float32Array.from(ps),
            f: Uint8Array.from(fs),
        };
        planPoints = [];
        if (g.plan) {
            for (let k = 0; k <= 64; k++)
                planPoints.push(cubic(g.plan, k / 64));
        }
    }

    function buildStars() {
        const tw = Math.max(640, Math.round(W + 360));
        const th = Math.round(H + 48);
        tile.width = Math.round(tw * dpr);
        tile.height = Math.round(th * dpr);
        const t = tile.getContext("2d")!;
        t.setTransform(dpr, 0, 0, dpr, 0, 0);
        t.clearRect(0, 0, tw, th);
        const count = Math.round((tw * th) / (palette.manual ? 15000 : 4200));
        const stars = starLayout(STAR_SEED, count, tw, th);
        if (palette.manual) {
            // Flight Manual: sparse ink specks, as printed.
            t.fillStyle = palette.ink3;
            for (const s of stars) {
                t.globalAlpha = s.mag === 1 ? 0.55 : s.mag === 2 ? 0.4 : 0.28;
                const d = s.mag === 1 ? 1.6 : 1.1;
                t.fillRect(s.x, s.y, d, d);
            }
        } else {
            const look = { 1: [1.05, 0.85], 2: [0.72, 0.55], 3: [0.5, 0.34] };
            t.fillStyle = `rgb(${palette.star})`;
            for (const s of stars) {
                const [r, a] = look[s.mag];
                t.globalAlpha = a;
                t.beginPath();
                t.arc(s.x, s.y, r, 0, Math.PI * 2);
                t.fill();
            }
        }
        t.globalAlpha = 1;
    }

    function buildRuler() {
        if (!g) return;
        track.replaceChildren();
        const width = Math.ceil(X(g.t1) + 400);
        track.setAttribute("width", String(width));
        track.setAttribute("height", "36");
        track.setAttribute("viewBox", `-200 0 ${width + 200} 36`);
        track.style.left = "-200px";
        track.style.width = `${width + 200}px`;
        const base = 12;
        const first = Math.floor(g.t0);
        const last = Math.ceil(g.t1);
        track.append(
            svg("line", {
                class: styles.base,
                x1: X(first - 0.5),
                x2: X(last + 0.5),
                y1: base + 0.5,
                y2: base + 0.5,
            }),
        );
        // No dates across a chapter whose start is not recorded: it is
        // flown over a nominal span, which the axis must not date.
        const unrecorded = data.chapters
            .filter((chapter) => !chapter.startKnown)
            .map((chapter) => [chapter.start - 0.3, chapter.end - 0.02]);
        for (let q = first * 4 - 2; q <= last * 4 + 2; q++) {
            const t = q / 4;
            if (unrecorded.some(([a, b]) => t > a && t < b)) continue;
            const x = Math.round(X(t)) + 0.5;
            const year = q % 4 === 0;
            track.append(
                svg("line", {
                    class: year ? styles.year : styles.minor,
                    x1: x,
                    x2: x,
                    y1: base - (year ? 7 : 3),
                    y2: base + (year ? 3 : 0),
                }),
            );
            if (year && t >= g.t0 - 0.25 && t <= g.t1 + 0.25) {
                const text = svg("text", {
                    x,
                    y: base + 16,
                    "text-anchor": "middle",
                });
                text.textContent = String(t);
                track.append(text);
            }
        }
        // Each chapter's span on the axis; an unrecorded start fades in.
        const defs = svg("defs", {});
        track.append(defs);
        spans = [];
        spanOn = -1;
        data.chapters.forEach((chapter, i) => {
            const x0 = X(chapter.start);
            const x1 = X(chapter.end);
            const now = i === g!.current;
            const rect = svg("rect", {
                class: now ? styles.spanNow : styles.span,
                x: x0,
                y: base - 2,
                width: Math.max(1.5, x1 - x0),
                height: 2,
            });
            if (!chapter.startKnown) {
                const id = `voyage-fade-${++uid}`;
                const grad = svg("linearGradient", { id });
                grad.append(
                    svg("stop", {
                        offset: 0,
                        "stop-color": "#fff",
                        "stop-opacity": 0,
                    }),
                    svg("stop", {
                        offset: 0.7,
                        "stop-color": "#fff",
                        "stop-opacity": 1,
                    }),
                );
                const mask = svg("mask", { id: `${id}-m` });
                mask.append(
                    svg("rect", {
                        x: x0,
                        y: base - 3,
                        width: Math.max(1.5, x1 - x0),
                        height: 4,
                        fill: `url(#${id})`,
                    }),
                );
                defs.append(grad, mask);
                rect.setAttribute("mask", `url(#${id}-m)`);
            }
            track.append(rect);
            spans.push(rect);
        });
        if (g.planned) {
            const y = base - 1;
            track.append(
                svg("line", {
                    class: styles.spanPlan,
                    x1: X(data.today),
                    x2: X(g.planned.s),
                    y1: y,
                    y2: y,
                }),
            );
        }
        const now = Math.round(X(data.today)) + 0.5;
        track.append(
            svg("line", {
                class: styles.now,
                x1: now,
                x2: now,
                y1: base - 9,
                y2: base + 5,
                "stroke-width": 1.5,
            }),
        );
    }

    function buildTicks() {
        tickNodes.forEach((node) => node.remove());
        tickNodes.length = 0;
        for (const tick of g?.ticks ?? []) {
            const node = el("span", styles.tick);
            node.textContent = tick.label;
            labelLayer.append(node);
            tickNodes.push(node);
        }
    }

    /* ---- resize: every size, the geometry and the samples ------------- */
    function resize(width: number, height: number, isWide: boolean) {
        W = Math.max(1, width);
        H = Math.max(1, height);
        wide = isWide;
        dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.width = `${W}px`;
        canvas.style.height = `${H}px`;

        let unit: number;
        let ppy: number;
        if (wide) {
            ax = W * 0.62;
            rulerY = H - 84;
            ay = Math.min(H * 0.47, rulerY - 250);
            unit = Math.min(H * 0.92, W * 0.5);
            ppy = W * 0.3;
            host.style.setProperty("--ruler-from", `${Math.round(W * 0.33)}px`);
        } else {
            // Phones: the record sits at the bottom; keep the scene and
            // the ruler above it.
            const stage = host.parentElement;
            const hud = stage?.querySelector("[data-date]")?.parentElement;
            let panelTop = H * 0.56;
            if (stage && hud) {
                panelTop =
                    hud.getBoundingClientRect().top -
                    stage.getBoundingClientRect().top;
            }
            panelTop = Math.min(Math.max(panelTop, H * 0.34), H * 0.8);
            rulerY = panelTop - 46;
            ax = W * 0.5;
            ay = Math.max(90, (rulerY - 8) * 0.47);
            unit = Math.min(W * 1.05, rulerY * 1.15);
            ppy = W * 0.5;
            host.style.setProperty("--ruler-from", "0px");
            host.style.setProperty(
                "--veil-solid",
                `${Math.round(H - panelTop + 4)}px`,
            );
            host.style.setProperty(
                "--veil-clear",
                `${Math.round(H - panelTop + 30)}px`,
            );
        }
        host.style.setProperty("--ruler-y", `${Math.round(rulerY)}px`);
        lead = W * 0.05;

        // The end of the route frames the current world and the planned
        // one together in the subject area: fit the time scale to it.
        const saturn = IMAGES.saturn;
        const ringExtent =
            saturn.rings && saturn.body
                ? saturn.rings.rx / saturn.body.rx
                : 2.2;
        const [from, to] = wide ? [W * 0.45, W * 0.95] : [W * 0.05, W * 0.95];
        const frameOf = (geo: Geometry) => {
            const last = geo.worlds.at(-1);
            const planned = geo.planned;
            const now = (data.today - geo.t0) * geo.ppy;
            if (!last || !planned) return null;
            const c = centreAt(last, data.today);
            const left = Math.min(c.x - last.R * 1.06, now - 16);
            const right = planned.x0 + planned.R + 8;
            return { left, right, time: (planned.s - data.today) * geo.ppy };
        };
        g = buildGeometry(data, route, { unit, ppy }, ringExtent);
        const fit = frameOf(g);
        if (fit && fit.right - fit.left > to - from && fit.time > 0) {
            const fixed = fit.right - fit.left - fit.time;
            const room = Math.max(to - from - fixed, W * 0.12);
            ppy = Math.max(W * 0.08, (ppy * room) / fit.time);
            g = buildGeometry(data, route, { unit, ppy }, ringExtent);
        }
        const end = frameOf(g);
        planTarget = end
            ? (end.left + end.right) / 2 + (ax - (from + to) / 2)
            : X(Math.max(data.today, g.t0));
        planTarget = Math.max(planTarget, X(data.today));

        // The photograph covers the stage and pans across its width over
        // the whole route.
        const aspect = IMAGES.backdrop.width / IMAGES.backdrop.height;
        let pw = Math.max(W * 1.22, H * 1.08 * aspect);
        let ph = pw / aspect;
        if (ph < H * 1.08) {
            ph = H * 1.08;
            pw = ph * aspect;
        }
        photoBox = { w: pw, h: ph, span: Math.max(1, planTarget) };
        photo.style.width = `${Math.round(pw)}px`;
        photo.style.height = `${Math.round(ph)}px`;

        sprites.clear();
        sample();
        buildStars();
        buildRuler();
        buildTicks();

        // Label sizes (a layout read, here and never in render).
        const measure = (node: HTMLElement) => {
            node.hidden = false;
            delete node.dataset.flip;
            return { w: node.offsetWidth, h: node.offsetHeight };
        };
        labelSize = labels.map(measure);
        tickSize = tickNodes.map(measure);

        data.chapters.forEach((_, i) => load(g!.worlds[i].body!));
        if (!palette.manual) loadPhoto();
    }

    /* ---- render: one frame, from the frame alone ---------------------- */
    function strokeTrail(p: number, ship: Vec, ox: number, oy: number) {
        const { x, y, p: ps, f } = trail;
        const count = x.length;
        // Six pens: flown, current leg and ahead, each behind or in front.
        const pens: (Path2D | null)[] = [null, null, null, null, null, null];
        let last = -1;
        let k = 0;
        let lo = 0;
        let hi = count - 1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (ps[mid] <= p) {
                k = mid;
                lo = mid + 1;
            } else hi = mid - 1;
        }
        const margin = 60;
        const add = (
            x0: number,
            y0: number,
            x1: number,
            y1: number,
            pen: number,
        ) => {
            const sx0 = x0 + ox;
            const sx1 = x1 + ox;
            if (
                (sx0 < -margin && sx1 < -margin) ||
                (sx0 > W + margin && sx1 > W + margin)
            ) {
                last = -1;
                return;
            }
            let path = pens[pen];
            if (!path) path = pens[pen] = new Path2D();
            if (pen !== last) path.moveTo(sx0, y0 + oy);
            path.lineTo(sx1, y1 + oy);
            last = pen;
        };
        const penOf = (i: number, ahead: boolean) =>
            (ahead ? 4 : f[i] & 2 ? 2 : 0) + (f[i] & 1);
        for (let i = 1; i <= k; i++)
            add(x[i - 1], y[i - 1], x[i], y[i], penOf(i, false));
        if (count) {
            add(
                x[k],
                y[k],
                ship.x,
                ship.y,
                penOf(Math.min(k + 1, count - 1), false),
            );
            last = -1;
            if (k + 1 < count)
                add(ship.x, ship.y, x[k + 1], y[k + 1], penOf(k + 1, true));
            for (let i = k + 2; i < count; i++)
                add(x[i - 1], y[i - 1], x[i], y[i], penOf(i, true));
        }
        return pens;
    }

    function drawPens(pens: (Path2D | null)[], back: boolean) {
        const looks = [
            { color: palette.ink2, width: 1.25, a: palette.manual ? 0.9 : 0.8 },
            { color: palette.accent, width: 1.6, a: 1 },
            { color: palette.ink3, width: 1, a: palette.manual ? 0.4 : 0.3 },
        ];
        for (let s = 0; s < 3; s++) {
            const path = pens[s * 2 + (back ? 1 : 0)];
            if (!path) continue;
            const look = looks[s];
            ctx.globalAlpha = look.a * (back ? 0.55 : 1);
            ctx.strokeStyle = look.color;
            ctx.lineWidth = look.width;
            ctx.stroke(path);
        }
        ctx.globalAlpha = 1;
    }

    function drawOrbit(
        w: World,
        sx: number,
        sy: number,
        half: "back" | "front",
        fade = 1,
    ) {
        ctx.beginPath();
        if (half === "back")
            ctx.ellipse(sx, sy, w.R, w.rr, ORBIT_ROLL, Math.PI, Math.PI * 2);
        else ctx.ellipse(sx, sy, w.R, w.rr, ORBIT_ROLL, 0, Math.PI);
        ctx.globalAlpha = (palette.manual ? 0.32 : 0.2) * fade;
        ctx.strokeStyle = palette.ink2;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    function sprite(w: World): HTMLCanvasElement | null {
        const name = w.body!;
        const ready = sprites.get(name);
        if (ready) return ready;
        const img = bodies.get(name);
        const info = IMAGES[name];
        if (!img?.complete || !img.naturalWidth || !info.body) return null;
        const scale = (w.r / (info.body.rx * info.width)) * dpr;
        const art = document.createElement("canvas");
        art.width = Math.max(1, Math.round(info.width * scale));
        art.height = Math.max(1, Math.round(info.height * scale));
        const c = art.getContext("2d")!;
        c.imageSmoothingQuality = "high";
        c.drawImage(img, 0, 0, art.width, art.height);
        sprites.set(name, art);
        return art;
    }

    function drawWorld(w: World, sx: number, sy: number) {
        const info = imageOf(w);
        const ry = bodyRy(w);
        if (!palette.manual) {
            // A soft shadow: the planet stands off the photograph behind.
            const reach = w.extent * 2.2;
            const halo = ctx.createRadialGradient(
                sx,
                sy,
                w.r * 0.9,
                sx,
                sy,
                reach,
            );
            halo.addColorStop(0, alpha(palette.bg, 0.6));
            halo.addColorStop(0.45, alpha(palette.bg, 0.22));
            halo.addColorStop(1, alpha(palette.bg, 0));
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(sx, sy, reach, 0, Math.PI * 2);
            ctx.fill();
        }
        const art = w.body ? sprite(w) : null;
        if (info?.body && art) {
            const scale = w.r / (info.body.rx * info.width);
            const dw = info.width * scale;
            const dh = info.height * scale;
            ctx.drawImage(
                art,
                sx - info.body.cx * dw,
                sy - info.body.cy * dh,
                dw,
                dh,
            );
        } else {
            // Until the photograph arrives: the disc as a plate.
            ctx.beginPath();
            ctx.ellipse(sx, sy, w.r, ry, 0, 0, Math.PI * 2);
            ctx.fillStyle = palette.manual
                ? alpha(palette.ink3, 0.12)
                : "#15151a";
            ctx.fill();
        }
        if (palette.manual) {
            ctx.beginPath();
            ctx.ellipse(sx, sy, w.r + 0.5, ry + 0.5, 0, 0, Math.PI * 2);
            ctx.strokeStyle = palette.ink2;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    function drawPlanned(w: World, sx: number, sy: number) {
        ctx.setLineDash([3, 4]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = palette.ink2;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(sx, sy, w.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.ellipse(sx, sy, w.R, w.rr, ORBIT_ROLL, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
    }

    function drawPlan(ox: number, oy: number) {
        if (planPoints.length < 2) return;
        ctx.setLineDash([4, 5]);
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = palette.ink2;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        planPoints.forEach((q, i) =>
            i ? ctx.lineTo(q.x + ox, q.y + oy) : ctx.moveTo(q.x + ox, q.y + oy),
        );
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
    }

    /** The plan's point at date t (the leg runs forward in x). */
    function planPointAt(t: number): Vec | null {
        if (!g?.plan) return null;
        const x = X(t);
        let lo = 0;
        let hi = 1;
        for (let k = 0; k < 28; k++) {
            const mid = (lo + hi) / 2;
            if (cubic(g.plan, mid).x < x) lo = mid;
            else hi = mid;
        }
        return cubic(g.plan, (lo + hi) / 2);
    }

    function drawShip(s: Vec, heading: Vec, burn: number) {
        const angle = Math.atan2(heading.y, heading.x);
        if (!palette.manual) {
            const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 16);
            glow.addColorStop(0, alpha(palette.ink1, 0.28));
            glow.addColorStop(1, alpha(palette.ink1, 0));
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(s.x, s.y, 16, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(angle);
        if (burn > 0.02) {
            // The plume: a bright core over a soft dark edge, so it reads
            // over a sunlit planet as well as over the dark.
            const len = 5 + 20 * burn;
            const flame = (width: number, color: string, a: number) => {
                const fill = ctx.createLinearGradient(-3, 0, -3 - len, 0);
                fill.addColorStop(0, alpha(color, a));
                fill.addColorStop(1, alpha(color, 0));
                ctx.fillStyle = fill;
                ctx.beginPath();
                ctx.moveTo(-3, -width);
                ctx.quadraticCurveTo(
                    -3 - len * 0.5,
                    -width * (1 + burn),
                    -3 - len,
                    0,
                );
                ctx.quadraticCurveTo(
                    -3 - len * 0.5,
                    width * (1 + burn),
                    -3,
                    width,
                );
                ctx.closePath();
                ctx.fill();
            };
            flame(3.4, palette.bg, 0.55);
            flame(1.9, palette.ink1, 0.95);
        }
        ctx.beginPath();
        ctx.moveTo(6.5, 0);
        ctx.lineTo(-4.5, 3.8);
        ctx.lineTo(-2.4, 0);
        ctx.lineTo(-4.5, -3.8);
        ctx.closePath();
        ctx.lineJoin = "round";
        ctx.lineWidth = 2;
        ctx.strokeStyle = palette.bg;
        ctx.stroke();
        ctx.fillStyle = palette.ink1;
        ctx.fill();
        ctx.restore();
    }

    /** The tracking brackets, as on a launch webcast: always on top, so
     *  the ship stays marked while it passes behind a planet. */
    function drawBrackets(s: Vec) {
        const b = 11;
        const arm = 3.5;
        ctx.beginPath();
        for (const [dx, dy] of [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
        ]) {
            const cx = Math.round(s.x + dx * b) + 0.5;
            const cy = Math.round(s.y + dy * b) + 0.5;
            ctx.moveTo(cx - dx * arm, cy);
            ctx.lineTo(cx, cy);
            ctx.lineTo(cx, cy - dy * arm);
        }
        // A dark edge first, so the brackets hold over a bright planet.
        ctx.lineCap = "square";
        ctx.strokeStyle = palette.bg;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.strokeStyle = palette.ink2;
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.lineCap = "butt";
        ctx.globalAlpha = 1;
    }

    function render(frame: Frame) {
        lastFrame = frame;
        if (!g || !W) return;
        const cam = cameraAt(g, route, frame, lead, planTarget);
        const ox = ax - cam.x;
        const oy = ay - cam.y;

        // Far: the photograph, slow.
        if (!palette.manual) {
            const k = Math.min(1, Math.max(0, cam.x / photoBox.span));
            const px = -(photoBox.w - W) * k;
            const py = -(photoBox.h - H) / 2 - cam.y * 0.05;
            photo.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
        }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);

        // Middle: the stars, a seeded tile at a fraction of the speed.
        const tw = tile.width / dpr;
        const th = tile.height / dpr;
        const sx = -(((cam.x * STAR_RATE) % tw) + tw) % tw;
        const sy = Math.max(-48, Math.min(0, -24 - cam.y * 0.2));
        ctx.drawImage(tile, sx, sy, tw, th);
        if (sx + tw < W) ctx.drawImage(tile, sx + tw, sy, tw, th);

        // Near: orbits, trail, worlds, ship.
        const ship = shipOn(g, frame.segment, frame.u, frame.index);
        const heading = headingOn(g, frame.segment, frame.u, frame.index);
        const pens = strokeTrail(frame.p, ship, ox, oy);
        const visible = (x: number, reach: number) =>
            x + reach > -20 && x - reach < W + 20;
        // On a phone the plan's frame is the current world and the next
        // one: the worlds already left behind recede.
        const recede =
            !wide && frame.segment.kind === "plan" ? smooth(frame.u) * 0.72 : 0;
        const placed = g.worlds.map((w) => {
            const c = centreAt(w, frame.t);
            const a = recede && w.index !== g!.current ? 1 - recede : 1;
            return { w, x: c.x + ox, y: c.y + oy, a };
        });

        for (const { w, x, y, a } of placed)
            if (w.kind === "coast" && visible(x, w.R))
                drawOrbit(w, x, y, "back", a);
        drawPens(pens, true);
        if (ship.back) drawShip({ x: ship.x + ox, y: ship.y + oy }, heading, 0);
        for (const { w, x, y, a } of placed)
            if (visible(x, w.extent * 2.2)) {
                ctx.globalAlpha = a;
                drawWorld(w, x, y);
                ctx.globalAlpha = 1;
            }
        for (const { w, x, y, a } of placed)
            if (w.kind === "coast" && visible(x, w.R))
                drawOrbit(w, x, y, "front", a);
        drawPens(pens, false);

        if (g.planned) {
            drawPlan(ox, oy);
            const px = g.planned.x0 + ox;
            if (visible(px, g.planned.R))
                drawPlanned(g.planned, px, g.planned.y + oy);
            ctx.strokeStyle = palette.ink2;
            ctx.lineWidth = 1;
            g.ticks.forEach((tick, i) => {
                const q = planPointAt(tick.t);
                const node = tickNodes[i];
                if (!q || !node) return;
                const x = q.x + ox;
                const y = q.y + oy;
                ctx.beginPath();
                ctx.moveTo(x, y - 5);
                ctx.lineTo(x, y + 5);
                ctx.stroke();
                const size = tickSize[i] ?? { w: 0, h: 0 };
                // The last date is the planned world's: set it under it.
                const atWorld = i === g!.ticks.length - 1 && g!.planned;
                // Otherwise under the tick, on the side the leg leaves clear.
                const ahead = planPointAt(tick.t + 0.05);
                const down = ahead ? ahead.y + oy > y : true;
                const shift = size.w / 2 + 2;
                const lx = atWorld
                    ? g!.planned!.x0 + ox
                    : x + (down ? -shift : shift);
                const ly = atWorld
                    ? g!.planned!.y + oy + g!.planned!.r + 10
                    : y + 9;
                const inside =
                    lx - size.w / 2 >= (wide ? W * 0.4 : 8) &&
                    lx + size.w / 2 <= W - 8;
                node.hidden = !(wide || frame.card === n) || !inside;
                node.style.transform = `translate3d(${Math.round(lx - size.w / 2)}px, ${Math.round(ly)}px, 0)`;
            });
        }
        if (!ship.back)
            drawShip(
                { x: ship.x + ox, y: ship.y + oy },
                heading,
                burnAt(frame),
            );
        drawBrackets({ x: ship.x + ox, y: ship.y + oy });

        // Wide layouts: everything drawn fades out under the record.
        if (wide) {
            const fade = ctx.createLinearGradient(W * 0.3, 0, W * 0.46, 0);
            fade.addColorStop(0, "#000");
            fade.addColorStop(1, "rgb(0 0 0 / 0)");
            ctx.globalCompositeOperation = "destination-out";
            ctx.fillStyle = fade;
            ctx.fillRect(0, 0, W * 0.46, H);
            ctx.globalCompositeOperation = "source-over";
        }

        // Labels beside the worlds; on phones, only the one on show.
        placed.forEach(({ w, x, y }, i) => {
            const node = labels[i];
            const size = labelSize[i] ?? { w: 0, h: 0 };
            const on = frame.card === i;
            // Only while the planet's centre is on screen.
            const show = (wide || on) && x > 4 && x < W - 4;
            node.hidden = !show;
            if (!show) return;
            if (on) node.dataset.on = "";
            else delete node.dataset.on;
            // Away from the lane's centre; a flyby's away from its pass.
            const above = w.swing ? w.swing.side.y > 0 : w.y < 0;
            const ry = bodyRy(w);
            const gap = 10;
            const top = above ? y - ry - gap - size.h : y + ry + gap;
            const flip = x + size.w > W - 12;
            if (flip) node.dataset.flip = "";
            else delete node.dataset.flip;
            node.dataset.side = above ? "above" : "below";
            const left = flip ? x - size.w + 1 : x;
            node.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
            if (wide) {
                const fade = Math.min(
                    1,
                    Math.max(0, (x - W * 0.34) / (W * 0.08)),
                );
                node.style.opacity = fade.toFixed(3);
            } else node.style.opacity = "";
        });

        // The ruler: the axis under everything, and the date on show.
        const onShow = frame.card < n ? frame.card : -1;
        if (onShow !== spanOn) {
            spans.forEach((rect, i) => {
                const cls =
                    i === g!.current
                        ? styles.spanNow
                        : i === onShow
                          ? styles.spanOn
                          : styles.span;
                rect.setAttribute("class", cls);
            });
            spanOn = onShow;
        }
        track.style.transform = `translate3d(${ox.toFixed(1)}px, 0, 0)`;
        const chapter = data.chapters[frame.segment.chapter];
        const held =
            frame.segment.kind === "coast" || frame.segment.kind === "flyby";
        const shown =
            chapter && held && !chapter.startKnown ? chapter.end : frame.t;
        playhead.style.transform = `translate3d(${(X(shown) + ox).toFixed(1)}px, 0, 0)`;
    }

    function theme() {
        palette = readPalette();
        if (W) buildStars();
        if (!palette.manual) loadPhoto();
    }

    function dispose() {
        disposed = true;
        host.classList.remove(styles.host);
        host.replaceChildren();
        for (const img of bodies.values()) {
            img.onload = null;
            img.src = "";
        }
        bodies.clear();
        for (const art of sprites.values()) art.width = 0;
        sprites.clear();
        photo.onload = null;
        photo.removeAttribute("src");
        canvas.width = 0;
        canvas.height = 0;
        tile.width = 0;
        tile.height = 0;
        lastFrame = null;
        g = null;
    }

    return { resize, render, theme, dispose };
}
