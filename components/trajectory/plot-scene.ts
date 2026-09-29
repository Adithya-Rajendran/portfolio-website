import type { Frame, Segment } from "@/lib/trajectory";
import type { CreateScene } from "./journey";
import styles from "./plot.module.css";

/**
 * Option A · Plot: the route as a mission-design plot on a tilted
 * ecliptic, in the site's hairline ink. Each chapter is a world on its own
 * orbit (inner orbits move faster); a coast rides with its world and
 * circles it on a parking ring, a flyby is a close pass, and a transfer is
 * a prograde spiral tangent to both orbits (Hohmann-like). The camera pulls
 * back as the route moves outward, then shows the whole plan: the orbit
 * ahead dashed, like the orbit map's planned orbit.
 *
 * Everything is drawn in screen space from world coordinates, so hairlines
 * stay one pixel at every zoom; words are HTML over the plot. Deterministic
 * in the frame's progress, so scrubbing back draws the same picture.
 */

type Vec = [number, number];

const NS = "http://www.w3.org/2000/svg";
const D2R = Math.PI / 180;
const SWEEP = 150;
const RING = 13;
const SAMPLES = 1400;
const PLAN_SAMPLES = 420;
let uid = 0;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const f1 = (n: number) => Math.round(n * 10) / 10;

/** Orbit radius of the i-th world, in world units. */
const radius = (i: number) => 100 * (1 + 0.62 * i + 0.03 * i * i);
/** Degrees per year: inner orbits move faster. */
const omega = (r: number) => (32 * 100) / r;

const polar = (p: Vec): Vec => [
    Math.hypot(p[0], p[1]),
    Math.atan2(-p[1], p[0]) / D2R,
];
const cart = (r: number, deg: number): Vec => [
    r * Math.cos(deg * D2R),
    -r * Math.sin(deg * D2R),
];
const tangent = (deg: number): Vec => [
    -Math.sin(deg * D2R),
    -Math.cos(deg * D2R),
];

/** A prograde spiral from A to B, tangent to both circles. */
function spiral(A: Vec, B: Vec) {
    const [ra, aa] = polar(A);
    let [rb, ab] = polar(B);
    while (ab < aa + 40) ab += 360;
    return (u: number): Vec => {
        const r = lerp(ra, rb, (1 - Math.cos(Math.PI * u)) / 2);
        return cart(r, lerp(aa, ab, u));
    };
}

function bezier(P0: Vec, P1: Vec, P2: Vec, P3: Vec) {
    return (u: number): Vec => {
        const v = 1 - u;
        const a = v * v * v,
            b = 3 * v * v * u,
            c = 3 * v * u * u,
            d = u * u * u;
        return [
            a * P0[0] + b * P1[0] + c * P2[0] + d * P3[0],
            a * P0[1] + b * P1[1] + c * P2[1] + d * P3[1],
        ];
    };
}

interface World {
    r: number;
    phi: number;
    label: string;
    dates: string;
}

function el<K extends keyof SVGElementTagNameMap>(
    name: K,
    className?: string,
): SVGElementTagNameMap[K] {
    const node = document.createElementNS(NS, name);
    if (className) node.setAttribute("class", className);
    return node;
}

export const createPlotScene: CreateScene = (host, data, route) => {
    const chapters = data.chapters;
    const n = chapters.length;
    const planned = data.planned;
    const today = data.today;

    /* ---- worlds and their phases ------------------------------------ */
    const worlds: World[] = chapters.map((chapter, i) => ({
        r: radius(i),
        phi: 0,
        label: chapter.orgLabel,
        dates: chapter.dates ?? "",
    }));
    const next: World = {
        r: radius(n),
        phi: 0,
        label: "",
        dates: planned?.lines.at(-1) ?? "",
    };
    const ang = (w: World, t: number) =>
        w.phi + omega(w.r) * (t - (chapters[0]?.start ?? 0));
    const pos = (w: World, t: number) => cart(w.r, ang(w, t));
    const setPhase = (w: World, deg: number, t: number) => {
        w.phi = deg - omega(w.r) * (t - (chapters[0]?.start ?? 0));
    };
    worlds.forEach((w, i) => {
        if (i === 0) setPhase(w, 205, chapters[0].start);
        else
            setPhase(
                w,
                ang(worlds[i - 1], chapters[i - 1].end) + SWEEP,
                chapters[i].start,
            );
    });
    const planCoastEnd = today + 1.6;
    const planArrive = today + 2;
    if (n) setPhase(next, ang(worlds[n - 1], planCoastEnd) + SWEEP, planArrive);

    // A flyby: a smooth pass that crosses the world's path mid-encounter,
    // entering inside its orbit and leaving outside it.
    const flybys = new Map<number, (u: number) => Vec>();
    chapters.forEach((chapter, i) => {
        if (!chapter.flyby) return;
        const w = worlds[i];
        const am = ang(w, (chapter.start + chapter.end) / 2);
        const da = 17;
        const L = (w.r * (2 * da * D2R)) / 3;
        const P0 = cart(w.r - 9, am - da);
        const P3 = cart(w.r + 15, am + da);
        const T0 = tangent(am - da);
        const T1 = tangent(am + da);
        flybys.set(
            i,
            bezier(
                P0,
                [P0[0] + T0[0] * L, P0[1] + T0[1] * L],
                [P3[0] - T1[0] * L, P3[1] - T1[1] * L],
                P3,
            ),
        );
    });

    /* ---- the route in world space ----------------------------------- */
    const segs = route.segments;
    const paths = new Map<Segment, (u: number) => Vec>();
    const point = (s: Segment, u: number): Vec => {
        const t = lerp(s.t0, s.t1, u);
        if (s.kind === "coast") return pos(worlds[s.chapter], t);
        if (s.kind === "flyby") return flybys.get(s.chapter)!(u);
        if (s.kind === "plan") return pos(worlds[n - 1], today);
        return paths.get(s)!(u);
    };
    segs.forEach((s, i) => {
        if (s.kind === "transfer")
            paths.set(s, spiral(point(segs[i - 1], 1), point(segs[i + 1], 0)));
    });
    const locate = (p: number): [Segment, number] => {
        const s = segs.find((seg) => p <= seg.p1) ?? segs[segs.length - 1];
        return [s, clamp((p - s.p0) / (s.p1 - s.p0 || 1))];
    };
    const trackAt = (p: number) => {
        const [s, u] = locate(p);
        return point(s, u);
    };
    const fitOf = (s: Segment): number =>
        s.kind === "plan" ? worlds[n - 1].r * 1.2 : worlds[s.chapter].r * 1.2;
    const fitAt = (s: Segment, u: number) => {
        if (s.kind === "transfer") {
            const i = segs.indexOf(s);
            return lerp(
                fitOf(segs[i - 1]) * 0.95,
                fitOf(segs[i + 1]),
                smooth(u),
            );
        }
        if (s.kind === "plan")
            return lerp(
                fitOf(s) * 0.95,
                next.r * 1.12,
                smooth(clamp(u / 0.75)),
            );
        return fitOf(s) * (1 - 0.05 * u);
    };
    const tiltAt = (p: number) => lerp(62, 48, smooth(p)) * D2R;

    const flown = route.flown;
    const trail: Vec[] = Array.from({ length: SAMPLES }, (_, i) =>
        trackAt((i / (SAMPLES - 1)) * flown),
    );
    // The current leg: the transfer onto the current chapter and after.
    const last = chapters[n - 1];
    const curSeg = last?.current
        ? segs.find((s) => s.kind === "transfer" && s.chapter === n - 1)
        : undefined;
    const iCur = curSeg
        ? Math.round((curSeg.p0 / flown) * (SAMPLES - 1))
        : SAMPLES;
    const plan: Vec[] = [];
    if (planned && n) {
        const out = spiral(
            pos(worlds[n - 1], planCoastEnd),
            pos(next, planArrive),
        );
        for (let i = 0; i < PLAN_SAMPLES; i++) {
            const u = i / (PLAN_SAMPLES - 1);
            plan.push(
                u < 0.3
                    ? pos(worlds[n - 1], lerp(today, planCoastEnd, u / 0.3))
                    : out((u - 0.3) / 0.7),
            );
        }
    }
    const tick = n ? pos(worlds[n - 1], today + 0.8) : ([0, 0] as Vec);

    /* ---- DOM ------------------------------------------------------- */
    host.classList.add(styles.host);
    const canvas = document.createElement("canvas");
    canvas.className = styles.stars;
    const ctx = canvas.getContext("2d");
    const svg = el("svg", styles.plot);
    svg.setAttribute("focusable", "false");
    const defs = el("defs");
    const grad = el("radialGradient");
    grad.id = `plot-glow-${++uid}`;
    grad.innerHTML = `<stop offset="0" class="${styles.glow0}"/><stop offset="1" class="${styles.glow1}"/>`;
    defs.append(grad);
    const ticks = el("path", styles.ticks);
    const orbitsG = el("g");
    const past = el("path", styles.trail);
    const cur = el("path", `${styles.trail} ${styles.cur}`);
    const planPath = el("path", `${styles.trail} ${styles.plan}`);
    const glow = el("circle");
    glow.setAttribute("r", "46");
    glow.setAttribute("fill", `url(#${grad.id})`);
    const sun = el("circle", styles.sun);
    sun.setAttribute("r", "4.5");
    const mark = el("line", styles.mark);
    const planetsG = el("g");
    const ring = el("ellipse", styles.ring);
    const plume = el("line", styles.plume);
    const now = el("circle", styles.now);
    now.setAttribute("r", "8");
    const ship = el("path", styles.ship);
    ship.setAttribute("d", "M7 0L-4.5-4L-2 0L-4.5 4Z");
    svg.append(
        defs,
        ticks,
        orbitsG,
        past,
        cur,
        planPath,
        glow,
        sun,
        mark,
        planetsG,
        ring,
        plume,
        now,
        ship,
    );
    const labels = document.createElement("div");
    labels.className = styles.labels;
    host.append(canvas, svg, labels);

    const orbitEls = worlds.map(() =>
        orbitsG.appendChild(el("ellipse", styles.orbit)),
    );
    const nextOrbit = planned
        ? orbitsG.appendChild(
              el("ellipse", `${styles.orbit} ${styles.planned}`),
          )
        : null;
    const planetEls = worlds.map(() =>
        planetsG.appendChild(el("circle", styles.planet)),
    );
    const nextPlanet = planned
        ? planetsG.appendChild(el("circle", styles.planetPlan))
        : null;
    const mkLabel = (name: string, detail: string) => {
        const d = document.createElement("div");
        d.className = styles.label;
        const b = document.createElement("b");
        b.textContent = name;
        const s = document.createElement("span");
        s.textContent = detail;
        d.append(b, s);
        labels.append(d);
        return { node: d, w: 0, h: 0 };
    };
    const worldLabels = worlds.map((w) => mkLabel(w.label, w.dates));
    const planLines = planned?.lines ?? [];
    const tickLabel = planned ? mkLabel("Planned", planLines[0] ?? "") : null;
    const nextLabel =
        planned && planLines.length > 1
            ? mkLabel("Next", planLines.at(-1)!)
            : null;

    /* ---- stars: a seeded field with depth --------------------------- */
    let seed = 11;
    const rand = () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const stars = Array.from({ length: 1100 }, () => ({
        x: rand() * 3.2 - 1.6,
        y: rand() * 3.2 - 1.6,
        z: rand(),
        m: Math.pow(rand(), 3.2),
    }));

    /* ---- layout ---------------------------------------------------- */
    let W = 1,
        H = 1,
        CX = 0,
        CY = 0,
        HW = 1,
        HH = 1,
        wide = true,
        dpr = 1,
        S = 1,
        S0 = 1,
        COS = 1,
        starKey = "",
        starRgb = "236,232,223",
        starA = 1;
    const P = (q: Vec): Vec => [CX + q[0] * S, CY + q[1] * S * COS];
    const scaleFor = (fit: number, cos: number) =>
        Math.min(HW / fit, HH / (fit * cos));
    const d = (pts: Vec[], from: number, to: number, head?: Vec | null) => {
        let out = "";
        for (let i = from; i <= to; i++) {
            const q = P(pts[i]);
            out += (i === from ? "M" : "L") + f1(q[0]) + " " + f1(q[1]);
        }
        if (head) {
            const q = P(head);
            out += "L" + f1(q[0]) + " " + f1(q[1]);
        }
        return out;
    };
    const readColours = () => {
        const cs = getComputedStyle(document.documentElement);
        starRgb = cs
            .getPropertyValue("--star-rgb")
            .trim()
            .split(/\s+/)
            .join(",");
        starA = document.documentElement.dataset.theme === "manual" ? 0.38 : 1;
        starKey = "";
    };
    readColours();

    const drawStars = () => {
        if (!ctx) return;
        const key = `${W}|${H}|${S.toFixed(3)}|${starRgb}`;
        if (key === starKey) return;
        starKey = key;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        const zoom = S / S0;
        const span = Math.max(W, H) * 0.62;
        for (const st of stars) {
            const k = Math.pow(zoom, 0.1 + 0.32 * st.z);
            const x = CX + st.x * span * k;
            const y = CY + st.y * span * k;
            if (x < -2 || y < -2 || x > W + 2 || y > H + 2) continue;
            ctx.fillStyle = `rgba(${starRgb},${((0.1 + 0.62 * st.m) * starA).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(x, y, 0.35 + 1.15 * st.m, 0, Math.PI * 2);
            ctx.fill();
        }
    };

    type Mode = "side" | "in" | "out";
    const place = (
        L: { node: HTMLDivElement; w: number; h: number },
        q: Vec,
        alpha: number,
        off: number,
        mode: Mode = "side",
        isCur = false,
        future = false,
    ) => {
        const node = L.node;
        node.style.opacity = String(alpha);
        node.toggleAttribute("data-cur", isCur);
        node.toggleAttribute("data-future", future);
        if (alpha <= 0) return;
        if (!L.w) {
            L.w = node.offsetWidth;
            L.h = node.offsetHeight;
        }
        const minX = wide ? W * 0.44 : 8;
        let x: number, y: number, align: string;
        if (mode === "side") {
            let left = q[0] < CX - 8;
            if (!left && q[0] + off + L.w > W - 8) left = true;
            else if (left && q[0] - off - L.w < minX) left = false;
            x = left ? q[0] - off - L.w : q[0] + off;
            y = q[1] - L.h / 2;
            align = left ? "right" : "left";
        } else {
            let vx = q[0] - CX,
                vy = q[1] - CY;
            const len = Math.hypot(vx, vy) || 1;
            vx /= len;
            vy /= len;
            if (mode === "in") {
                vx = -vx;
                vy = -vy;
            }
            x = q[0] + vx * off + (-0.5 + 0.5 * vx) * L.w;
            y = q[1] + vy * off + (-0.5 + 0.5 * vy) * L.h;
            align = Math.abs(vx) < 0.5 ? "center" : vx < 0 ? "right" : "left";
        }
        x = clamp(x, 8, W - 8 - L.w);
        y = clamp(y, 8, H - 8 - L.h);
        node.style.transform = `translate(${f1(x)}px, ${f1(y)}px)`;
        node.style.textAlign = align;
    };

    const shipAt = (p: number) => {
        const [s, u] = locate(p);
        const base = P(point(s, u));
        let k = 0;
        if (s.kind === "coast") {
            const lastCoast = s.chapter === n - 1;
            k =
                smooth(clamp(u / 0.14)) *
                (lastCoast ? 1 : smooth(clamp((1 - u) / 0.14)));
        }
        if (s.kind === "plan") k = 1;
        const g = p * 360 * 7 * D2R;
        return {
            base,
            k,
            x: base[0] + k * RING * Math.cos(g),
            y: base[1] + k * RING * Math.sin(g) * COS,
        };
    };

    const render = (frame: Frame) => {
        const p = frame.p;
        const s = frame.segment;
        const u = frame.u;
        const t = frame.t;
        COS = Math.cos(tiltAt(p));
        S = scaleFor(fitAt(s, u), COS);

        // A degree ring beyond the outermost orbit
        const RT = (planned ? next.r : worlds[n - 1].r) * 1.09;
        let dd = "";
        for (let a = 0; a < 360; a += 5) {
            const len = a % 30 === 0 ? 9 : 4;
            const q0 = P(cart(RT, a));
            const q1 = P(cart(RT + len / S, a));
            dd += `M${f1(q0[0])} ${f1(q0[1])}L${f1(q1[0])} ${f1(q1[1])}`;
        }
        ticks.setAttribute("d", dd);

        const setOrbit = (e: SVGEllipseElement, r: number) => {
            e.setAttribute("cx", String(f1(CX)));
            e.setAttribute("cy", String(f1(CY)));
            e.setAttribute("rx", String(f1(r * S)));
            e.setAttribute("ry", String(f1(r * S * COS)));
        };
        worlds.forEach((w, i) => {
            const seg = segs.find(
                (x) => x.kind !== "transfer" && x.chapter === i,
            )!;
            const visited = p >= seg.p0 - 1e-6;
            const isCur = frame.card === i;
            setOrbit(orbitEls[i], w.r);
            orbitEls[i].toggleAttribute("data-visited", visited && !isCur);
            orbitEls[i].toggleAttribute("data-cur", isCur);
            const q = P(pos(w, t));
            planetEls[i].setAttribute("cx", String(f1(q[0])));
            planetEls[i].setAttribute("cy", String(f1(q[1])));
            planetEls[i].setAttribute("r", visited ? "4" : "3");
            planetEls[i].toggleAttribute("data-future", !visited);
            const approach =
                s.kind === "transfer" && s.chapter === i ? smooth(u) * 0.7 : 0;
            const mode: Mode = i === n - 1 && s.kind === "plan" ? "in" : "side";
            const alpha = visited ? 1 : approach;
            // Phones label only what the current chapter is about.
            const shown =
                wide || isCur || (!visited && approach > 0) ? alpha : 0;
            place(
                worldLabels[i],
                q,
                shown,
                mode === "in"
                    ? RING + 16
                    : isCur && seg.kind === "coast"
                      ? RING + 10
                      : 12,
                mode,
                isCur,
                !visited,
            );
        });

        const planOn = s.kind === "plan" ? smooth(clamp((u - 0.15) / 0.45)) : 0;
        if (nextOrbit) setOrbit(nextOrbit, next.r);
        if (nextPlanet) {
            const qn = P(pos(next, planArrive));
            nextPlanet.setAttribute("cx", String(f1(qn[0])));
            nextPlanet.setAttribute("cy", String(f1(qn[1])));
            nextPlanet.setAttribute("r", "5");
            nextPlanet.style.opacity = String(planOn);
            if (nextLabel) place(nextLabel, qn, planOn, 14, "out");
        }
        if (tickLabel) {
            const qi = P(tick);
            const vx = qi[0] - CX,
                vy = qi[1] - CY;
            const len = Math.hypot(vx, vy) || 1;
            mark.setAttribute("x1", String(f1(qi[0] - (vx / len) * 4)));
            mark.setAttribute("y1", String(f1(qi[1] - (vy / len) * 4)));
            mark.setAttribute("x2", String(f1(qi[0] + (vx / len) * 4)));
            mark.setAttribute("y2", String(f1(qi[1] + (vy / len) * 4)));
            mark.style.opacity = String(planOn);
            place(tickLabel, qi, planOn, 20, "out");
        }

        sun.setAttribute("cx", String(f1(CX)));
        sun.setAttribute("cy", String(f1(CY)));
        glow.setAttribute("cx", String(f1(CX)));
        glow.setAttribute("cy", String(f1(CY)));

        const pp = Math.min(p, flown);
        const i = Math.floor((pp / flown) * (SAMPLES - 1));
        const head = trackAt(pp);
        past.setAttribute(
            "d",
            pp > 0
                ? d(trail, 0, Math.min(i, iCur), i < iCur ? head : null)
                : "",
        );
        cur.setAttribute("d", i >= iCur ? d(trail, iCur, i, head) : "");
        const k = Math.floor(clamp((u - 0.05) / 0.6) * (PLAN_SAMPLES - 1));
        planPath.setAttribute(
            "d",
            s.kind === "plan" && k > 0 && plan.length ? d(plan, 0, k) : "",
        );

        const sh = shipAt(p);
        const a0 = shipAt(Math.max(0, p - 0.0012));
        const a1 = shipAt(Math.min(1, p + 0.0012));
        const hd = Math.atan2(a1.y - a0.y, a1.x - a0.x);
        ship.setAttribute(
            "transform",
            `translate(${f1(sh.x)} ${f1(sh.y)}) rotate(${f1(hd / D2R)})`,
        );
        ring.setAttribute("cx", String(f1(sh.base[0])));
        ring.setAttribute("cy", String(f1(sh.base[1])));
        ring.setAttribute("rx", String(RING));
        ring.setAttribute("ry", String(f1(RING * COS)));
        ring.style.opacity = String(sh.k * 0.9);
        const burn =
            s.kind === "transfer"
                ? Math.max(1 - u / 0.14, (u - 0.86) / 0.14, 0)
                : 0;
        plume.setAttribute("x1", String(f1(sh.x - Math.cos(hd) * 6)));
        plume.setAttribute("y1", String(f1(sh.y - Math.sin(hd) * 6)));
        plume.setAttribute(
            "x2",
            String(f1(sh.x - Math.cos(hd) * (6 + 12 * burn))),
        );
        plume.setAttribute(
            "y2",
            String(f1(sh.y - Math.sin(hd) * (6 + 12 * burn))),
        );
        plume.style.opacity = String(burn);
        now.setAttribute("cx", String(f1(sh.x)));
        now.setAttribute("cy", String(f1(sh.y)));
        now.style.opacity = last?.current && p >= flown - 1e-4 ? "1" : "0";

        drawStars();
    };

    return {
        resize(width, height, isWide) {
            W = Math.max(1, width);
            H = Math.max(1, height);
            wide = isWide;
            if (wide) {
                CX = W * 0.655;
                CY = H * 0.5;
                HW = Math.min(W - CX - 44, W * 0.3);
                HH = H * 0.41;
            } else {
                CX = W * 0.5;
                CY = H * 0.28;
                HW = W * 0.45;
                HH = H * 0.23;
            }
            svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
            dpr = Math.min(2, window.devicePixelRatio || 1);
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            S0 = n ? scaleFor(worlds[0].r * 1.2, Math.cos(tiltAt(0))) : 1;
            starKey = "";
            [...worldLabels, tickLabel, nextLabel].forEach((L) => {
                if (L) L.w = 0;
            });
        },
        render(frame) {
            if (n) render(frame);
        },
        theme() {
            readColours();
        },
        dispose() {
            host.classList.remove(styles.host);
            host.replaceChildren();
        },
    };
};
