import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
    applyHomeFinish,
    applyHomeSurface,
    HOME_SCAN_COLOR,
    HOME_SURVEY,
    homeFinishAt,
} from "./home-lighting";

/**
 * Where the landers stand, in scene coordinates: a line across the open
 * crater floor north of the outpost and west of the butte. A vehicle fifty
 * metres tall has to be that far away to sit inside the frame. `heading`
 * turns each so its steel side and both pairs of flaps face the outpost.
 */
export const HOME_SHIP_SITES = [
    { x: -305, z: -530, heading: -0.54 },
    { x: -430, z: -637, heading: -0.62 },
    { x: -556, z: -744, heading: -0.47 },
] as const;
/**
 * The staked cable way from the court to the rover's ground, in scene
 * coordinates. It keeps to one side of the rover's own ruts.
 */
export const HOME_CABLE_WAY = [
    [4.9, -5.4],
    [2, -14],
    [-3, -19],
    [-7.5, -20.6],
    [-10.6, -24.6],
] as const;

/**
 * Ground the crew levelled beyond the pad itself, in scene coordinates:
 * under the second greenhouse and under the solar field. Level out to the
 * first distance, natural again by the second.
 */
export const HOME_YARD_GROUND = [
    { x: 8.5, z: -22.2, level: 5, natural: 11 },
    { x: -19.1, z: -17.65, level: 8, natural: 15 },
] as const;

/**
 * The survey drone on its charging pad in the court. The file's origin is
 * the pad's centre; turned about, its pedestal and cabinet stand clear of
 * the airlock stair.
 */
const DRONE: Built = {
    url: "/models/home-drone-v1.glb",
    x: -4.8,
    z: -16.2,
    heading: Math.PI,
};

/**
 * The drone's survey, in the settlement's own coordinates: a closed round
 * through these places, each with its height above the ground there, the
 * share of cruising speed it is passed at, and whether the instrument sweeps
 * what stands under it. It leaves the pad for the rover, works along the
 * rocks to the gardens, crosses the roofs behind the dish and comes home
 * over the solar field.
 */
const SURVEY: readonly [
    x: number,
    z: number,
    height: number,
    pace: number,
    sweeps: number,
][] = [
    [-4.8, -16.2, 4.2, 0.35, 0],
    [0.5, -6, 4.8, 1, 0],
    [4.2, 6.6, 3.5, 0.1, 1],
    [8.8, 12.7, 3.3, 0.4, 1],
    [15.5, -5, 5.2, 1, 0],
    [10.5, -14.2, 6.8, 0.22, 1],
    [4.5, -17.5, 7.4, 0.22, 1],
    [-2, -24.5, 9.6, 0.6, 1],
    [-10, -34, 10.6, 1, 0],
    [-21, -27, 8.6, 1, 0],
    [-17, -9.7, 4.4, 0.2, 1],
    [-9.5, -11.5, 4.4, 1, 0],
];
/** Cruising speed in metres a second, and half the fan's spread. */
const SURVEY_SPEED = 3,
    SURVEY_SPREAD = T.MathUtils.degToRad(40);

/** Each stands on ground graded level this far out, natural beyond the second. */
export const HOME_SHIP_GRADE = { level: 40, natural: 78 };
/** What a lander's hull puts between the sun and the plain, in metres. */
export const HOME_SHIP_HULL = { height: 47, radius: 2.6 };
/** A landing pad's surface stands this far above the graded ground. */
const PAD_RISE = 0.3;
const SHIP = "/models/home-ship-v1.glb";

/**
 * Hardware built offline and set down in settlement coordinates, turned by
 * `heading` about the vertical. Each file names its materials after the
 * finishes below and carries baked shading at every vertex; `lite` is the
 * same build without its smallest parts, for touch devices. See
 * docs/hero-artwork.md for how they are made.
 */
interface Built {
    url: string;
    lite?: string;
    x: number;
    z: number;
    heading?: number;
}

/**
 * The pressurised plan: two vertical nodes on one axis, every vessel docked
 * to a node port on a common deck line. Its origin is the hub node's centre.
 */
const OUTPOST: Built = {
    url: "/models/home-outpost-v1.glb",
    lite: "/models/home-outpost-lite-v1.glb",
    x: -11,
    z: -25,
};
/**
 * The yard about the outpost, in the outpost's own frame: two greenhouses
 * and their airlock, the solar field, and two guyed masts. Each stands on
 * its own ground.
 */
const YARD: Built = {
    url: "/models/home-yard-v1.glb",
    lite: "/models/home-yard-lite-v1.glb",
    x: OUTPOST.x,
    z: OUTPOST.z,
};

/**
 * An original research outpost drawn as flight hardware rather than
 * architecture: welded stainless pressure vessels on cradles, white painted
 * end domes and radiators, dark anodised mechanisms, gold foil tanks and a
 * single amber signal colour. Repeated details share one draw per finish.
 */
export function makeHomeFrontier(
    groundHeightAt: (x: number, z: number) => number,
    environment: T.Texture,
    surfaceAt: (x: number, z: number) => number,
    loadModel: (url: string) => Promise<T.Object3D>,
    lite: boolean,
    anisotropy: number,
) {
    const root = new T.Group();
    const settlement = new T.Group();
    root.add(settlement);
    const heightAt = (x: number, z: number) => groundHeightAt(x - 2, z - 8);
    const buildings = new T.Group();
    settlement.add(buildings);
    let seed = 23;
    const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };

    const painted = (width: number, height: number, color: boolean) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const texture = new T.CanvasTexture(canvas);
        if (color) texture.colorSpace = T.SRGBColorSpace;
        texture.wrapS = texture.wrapT = T.RepeatWrapping;
        texture.anisotropy = anisotropy;
        return { paint: canvas.getContext("2d")!, texture };
    };

    // Welded stainless: rings of plate, each a slightly different melt,
    // brushed around the vessel, with a raised bead and heat tint at every
    // seam. One tile is 3.6 m around by 2.4 m along the axis. The second
    // canvas carries height in red and roughness in green.
    const PLATE = 512;
    const plateTone = painted(PLATE, PLATE, true);
    const plateDetail = painted(PLATE, PLATE, false);
    plateTone.paint.fillStyle = "#c2c4c8";
    plateTone.paint.fillRect(0, 0, PLATE, PLATE);
    plateDetail.paint.fillStyle = "rgb(128,162,0)";
    plateDetail.paint.fillRect(0, 0, PLATE, PLATE);
    const seams: number[][] = [];
    for (let course = 0; course < 2; course++)
        for (let plate = 0; plate < 2; plate++) {
            const x = (plate * 0.5 + course * 0.27) * PLATE,
                y = (course * PLATE) / 2;
            const shade = 184 + Math.floor(random() * 20),
                tint = Math.floor(random() * 7) - 3,
                rough = 146 + Math.floor(random() * 36);
            for (const wrap of [0, -PLATE]) {
                plateTone.paint.fillStyle = `rgb(${shade + tint},${shade},${shade - tint + 3})`;
                plateTone.paint.fillRect(x + wrap, y, PLATE / 2, PLATE / 2);
                plateDetail.paint.fillStyle = `rgb(128,${rough},0)`;
                plateDetail.paint.fillRect(x + wrap, y, PLATE / 2, PLATE / 2);
            }
            seams.push([x, y, 0, PLATE / 2]);
        }
    seams.push([0, 0, PLATE, 0], [0, PLATE / 2, PLATE, 0]);
    for (let i = 0; i < 3400; i++) {
        const x = random() * PLATE,
            y = Math.floor(random() * PLATE),
            length = 30 + random() * 170,
            alpha = 0.025 + random() * 0.045,
            light = random() > 0.5;
        for (const wrap of [0, -PLATE]) {
            plateTone.paint.fillStyle = light
                ? `rgba(255,255,255,${alpha})`
                : `rgba(18,22,28,${alpha})`;
            plateTone.paint.fillRect(x + wrap, y, length, 1);
            plateDetail.paint.fillStyle = light
                ? `rgba(128,100,0,${alpha * 2.4})`
                : `rgba(128,200,0,${alpha * 2.4})`;
            plateDetail.paint.fillRect(x + wrap, y, length, 1);
        }
    }
    for (const [x, y, w, h] of seams)
        for (const wrapX of [0, -PLATE, PLATE])
            for (const wrapY of [0, -PLATE, PLATE]) {
                const along = (
                    paint: CanvasRenderingContext2D,
                    half: number,
                    style: string,
                ) => {
                    paint.fillStyle = style;
                    paint.fillRect(
                        x + wrapX - (w ? 0 : half),
                        y + wrapY - (h ? 0 : half),
                        w || half * 2,
                        h || half * 2,
                    );
                };
                along(plateTone.paint, 13, "rgba(62,84,138,0.13)");
                along(plateTone.paint, 7, "rgba(150,116,66,0.2)");
                along(plateTone.paint, 1.5, "rgba(226,229,233,0.85)");
                along(plateDetail.paint, 9, "rgba(128,170,0,0.5)");
                along(plateDetail.paint, 2.5, "rgba(224,185,0,0.95)");
            }
    for (const map of [plateTone.texture, plateDetail.texture])
        map.repeat.set(1 / 3.6, 1 / 2.4);

    // White thermal-control panels with seams, fasteners and service marks.
    const panelCanvas = painted(1024, 512, true);
    panelCanvas.paint.fillStyle = "#d3d1ca";
    panelCanvas.paint.fillRect(0, 0, 1024, 512);
    for (let row = 0; row < 4; row++)
        for (let col = 0; col < 8; col++) {
            const x = col * 128,
                y = row * 128;
            const tone = 222 + ((col * 17 + row * 13) % 9);
            panelCanvas.paint.fillStyle = `rgb(${tone},${tone},${tone - 5})`;
            panelCanvas.paint.fillRect(x + 1.5, y + 1.5, 125, 125);
            panelCanvas.paint.strokeStyle = "#7c858570";
            panelCanvas.paint.lineWidth = 1;
            panelCanvas.paint.strokeRect(x + 4, y + 4, 120, 120);
            for (const dx of [8, 64, 120])
                for (const dy of [8, 120]) {
                    panelCanvas.paint.fillStyle = "#737c7a";
                    panelCanvas.paint.fillRect(x + dx - 1, y + dy - 1, 2, 2);
                }
            if ((row * 3 + col) % 7 === 0) {
                panelCanvas.paint.fillStyle = "#c98331";
                panelCanvas.paint.fillRect(x + 14, y + 100, 26, 4);
                panelCanvas.paint.fillStyle = "#59625f";
                panelCanvas.paint.fillRect(x + 46, y + 100, 44, 1);
                panelCanvas.paint.fillRect(x + 46, y + 103, 28, 1);
            }
            if ((row + col * 2) % 5 === 0) {
                panelCanvas.paint.fillStyle = "#8a9390";
                for (let slat = 0; slat < 7; slat++)
                    panelCanvas.paint.fillRect(
                        x + 78,
                        y + 22 + slat * 4,
                        30,
                        1,
                    );
            }
        }
    for (let i = 0; i < 16000; i++) {
        panelCanvas.paint.fillStyle = i % 2 ? "#ffffff0b" : "#2d362f12";
        panelCanvas.paint.fillRect(random() * 1024, random() * 512, 1, 1);
    }

    // Crinkled multilayer insulation, as a height map of creased facets.
    const foilCanvas = painted(256, 256, false);
    foilCanvas.paint.fillStyle = "#808080";
    foilCanvas.paint.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 520; i++) {
        const x = random() * 256,
            y = random() * 256,
            grey = 70 + Math.floor(random() * 120);
        foilCanvas.paint.fillStyle = `rgba(${grey},${grey},${grey},0.55)`;
        foilCanvas.paint.beginPath();
        foilCanvas.paint.moveTo(x, y);
        foilCanvas.paint.lineTo(x + random() * 46 - 23, y + random() * 46 - 23);
        foilCanvas.paint.lineTo(x + random() * 46 - 23, y + random() * 46 - 23);
        foilCanvas.paint.fill();
    }

    // Photovoltaic cells with bus bars and fine collector fingers.
    const cellCanvas = painted(256, 256, true);
    cellCanvas.paint.fillStyle = "#0a1220";
    cellCanvas.paint.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 4; row++)
        for (let col = 0; col < 4; col++) {
            const x = col * 64,
                y = row * 64,
                tone = (row * 3 + col * 5) % 4;
            cellCanvas.paint.fillStyle = `rgb(${15 + tone},${27 + tone * 2},${54 + tone * 3})`;
            cellCanvas.paint.fillRect(x + 2, y + 2, 60, 60);
            cellCanvas.paint.fillStyle = "rgba(150,162,184,0.13)";
            for (let finger = 0; finger < 10; finger++)
                cellCanvas.paint.fillRect(x + 5 + finger * 6, y + 2, 1, 60);
            cellCanvas.paint.fillStyle = "rgba(176,186,202,0.6)";
            cellCanvas.paint.fillRect(x + 2, y + 21, 60, 1.5);
            cellCanvas.paint.fillRect(x + 2, y + 42, 60, 1.5);
        }

    // Heat-shield tiles: black hexagons 0.3 m across with a pale filler
    // between them, each a little different, a few replaced with newer,
    // darker ones. One canvas is eight tiles wide (2.4 m) by eight rows tall
    // (2.08 m). The second canvas carries height in red, roughness in green.
    const TILE = 512;
    const tileTone = painted(TILE, TILE, true);
    const tileDetail = painted(TILE, TILE, false);
    tileTone.paint.fillStyle = "#77797c";
    tileTone.paint.fillRect(0, 0, TILE, TILE);
    tileDetail.paint.fillStyle = "rgb(70,235,0)";
    tileDetail.paint.fillRect(0, 0, TILE, TILE);
    for (let row = -1; row <= 8; row++)
        for (let col = -1; col <= 8; col++) {
            const x = (col + (row & 1 ? 0.5 : 0)) * 64,
                y = row * 64;
            // The same tile must meet itself across the canvas edge.
            const key = ((row + 8) % 8) * 8 + ((col + 8) % 8);
            const pick = Math.abs(Math.sin(key * 12.9898) * 43758.5453) % 1;
            const tone = pick < 0.07 ? 20 : 30 + Math.floor(pick * 22);
            for (const [paint, style] of [
                [tileTone.paint, `rgb(${tone},${tone},${tone + 2})`],
                [
                    tileDetail.paint,
                    `rgb(${172 + Math.floor(pick * 40)},${142 + Math.floor(pick * 50)},0)`,
                ],
            ] as const) {
                paint.fillStyle = style;
                paint.beginPath();
                for (let corner = 0; corner < 6; corner++) {
                    const turn = (corner * Math.PI) / 3 + Math.PI / 6;
                    // Rows are drawn 64 px apart for a true spacing of 55.4.
                    paint.lineTo(
                        x + 32 + Math.cos(turn) * 35.2,
                        y + 32 + Math.sin(turn) * 35.2 * 1.155,
                    );
                }
                paint.fill();
            }
        }
    for (const map of [tileTone.texture, tileDetail.texture])
        map.repeat.set(1 / 2.4, 1 / 2.078);

    // Module designations are stencilled in the page's own monospace face,
    // painted once that face is available.
    const LABELS = [
        "OPS 01",
        "HAB 02",
        "LAB 03",
        "HAB 04",
        "LOG 05",
        "EVA 06",
        "GRN 07",
        "PWR 08",
    ];
    const labelCanvas = painted(640, 128 * LABELS.length, true);
    labelCanvas.texture.wrapS = labelCanvas.texture.wrapT =
        T.ClampToEdgeWrapping;
    const stencil = () => {
        const paint = labelCanvas.paint;
        paint.clearRect(0, 0, 640, 128 * LABELS.length);
        paint.textBaseline = "middle";
        paint.font = "92px DMMono, monospace";
        LABELS.forEach((label, row) => {
            paint.fillStyle = "#c98331";
            paint.fillRect(18, row * 128 + 24, 20, 80);
            paint.fillStyle = "#1d2428";
            paint.fillText(label, 62, row * 128 + 68);
        });
        labelCanvas.texture.needsUpdate = true;
    };
    stencil();
    const lettered = document.fonts
        .load("92px DMMono")
        .then(stencil)
        .catch(() => {});

    // Every surface fades into the scene's haze and carries its dust.
    const finish = <M extends T.MeshStandardMaterial>(material: M) => {
        material.envMap = environment;
        material.onBeforeCompile = applyHomeFinish;
        return material;
    };
    const flat = (
        color: number,
        metalness: number,
        roughness: number,
        envMapIntensity = 0.8,
    ) =>
        finish(
            new T.MeshStandardMaterial({
                color,
                metalness,
                roughness,
                envMapIntensity,
            }),
        );
    const steel = finish(
        new T.MeshStandardMaterial({
            map: plateTone.texture,
            roughnessMap: plateDetail.texture,
            bumpMap: plateDetail.texture,
            bumpScale: 0.0035,
            metalness: 1,
            roughness: 1,
        }),
    );
    const paint = finish(
        new T.MeshStandardMaterial({
            color: 0xe4e2da,
            map: panelCanvas.texture,
            bumpMap: panelCanvas.texture,
            bumpScale: 0.006,
            metalness: 0,
            roughness: 0.52,
            envMapIntensity: 0.55,
        }),
    );
    const frame = flat(0x8a9096, 1, 0.46, 1);
    const anodized = flat(0x262c31, 0.85, 0.4);
    const black = flat(0x101214, 0.15, 0.72, 0.5);
    const signal = flat(0xd4832a, 0, 0.6, 0.4);
    const fabric = flat(0xd6d3c8, 0, 0.92, 0.3);
    const copper = flat(0x9b6540, 0.7, 0.46);
    // Leaves pass the lamps' light as well as reflect it.
    const vegetation = flat(0x3d6a33, 0, 0.9, 0.2);
    vegetation.emissive.setHex(0x2a6a1e);
    vegetation.emissiveIntensity = 0.45;
    const foil = finish(
        new T.MeshStandardMaterial({
            color: 0xc9a04e,
            metalness: 1,
            roughness: 0.42,
            bumpMap: foilCanvas.texture,
            bumpScale: 0.014,
        }),
    );
    const solar = finish(
        new T.MeshStandardMaterial({
            map: cellCanvas.texture,
            metalness: 0.55,
            roughness: 0.2,
            envMapIntensity: 1.3,
        }),
    );
    // Graded ground under a pad or a berm, and the ceramic of a heat shield.
    const regolith = flat(0x53473b, 0, 0.97, 0.15);
    const ceramic = finish(
        new T.MeshStandardMaterial({
            map: tileTone.texture,
            bumpMap: tileDetail.texture,
            bumpScale: 0.012,
            roughnessMap: tileDetail.texture,
            metalness: 0,
            roughness: 1,
            envMapIntensity: 0.9,
        }),
    );
    const pane = flat(0x0d1317, 0.9, 0.1, 1.2);
    // Lit rooms and lamps are brighter than the display's white, so the
    // lens spreads them. Occupied rooms differ and some are dark.
    const glow = (color: number, emissive: number, intensity: number) =>
        finish(
            new T.MeshStandardMaterial({
                color,
                emissive,
                emissiveIntensity: intensity,
                roughness: 0.3,
                metalness: 0.1,
            }),
        );
    const lit = glow(0xe0bc78, 0xd9a05a, 2.3);
    const dim = glow(0xe0bc78, 0xd9a05a, 0.8);
    const work = glow(0xdfe6f2, 0xcfdcf2, 2.4);
    const amber = glow(0xe0a050, 0xe08a2c, 2.6);
    const beacon = glow(0xd65a30, 0xe2441c, 3);
    const grow = glow(0xf3ddd2, 0xf0c7b6, 1.5);
    const glass = finish(
        new T.MeshPhysicalMaterial({
            color: 0x7fa3a8,
            metalness: 0.05,
            roughness: 0.1,
            clearcoat: 0.6,
            clearcoatRoughness: 0.2,
            transparent: true,
            opacity: 0.2,
            depthWrite: false,
            envMapIntensity: 0.9,
        }),
    );
    // A turning rotor is three blades smeared around a faint disc. Across
    // the texture is once around the hub; up it is hub to tip.
    const rotorBlur = (() => {
        const width = 96,
            height = 16,
            texels = new Uint8Array(width * height * 4);
        const { smoothstep } = T.MathUtils;
        for (let row = 0; row < height; row++) {
            const out = (row + 0.5) / height;
            const span =
                smoothstep(out, 0.05, 0.2) *
                (0.75 + 0.25 * out) *
                (1 - smoothstep(out, 0.95, 1));
            for (let column = 0; column < width; column++) {
                const turn = ((column + 0.5) / width) * Math.PI * 2;
                const blade = (0.5 + 0.5 * Math.cos(turn * 3)) ** 4;
                texels.fill(
                    Math.round(255 * span * (0.16 + 0.5 * blade)),
                    (row * width + column) * 4,
                    (row * width + column) * 4 + 4,
                );
            }
        }
        const texture = new T.DataTexture(texels, width, height);
        texture.wrapS = T.RepeatWrapping;
        texture.minFilter = texture.magFilter = T.LinearFilter;
        texture.needsUpdate = true;
        return texture;
    })();
    const rotor = finish(
        new T.MeshStandardMaterial({
            color: 0x23272b,
            alphaMap: rotorBlur,
            transparent: true,
            depthWrite: false,
            side: T.DoubleSide,
            roughness: 0.45,
            metalness: 0.2,
        }),
    );
    const stencilled = finish(
        new T.MeshStandardMaterial({
            map: labelCanvas.texture,
            transparent: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            roughness: 0.7,
            metalness: 0,
            envMapIntensity: 0.2,
        }),
    );

    // A built model's materials are replaced, by name, with these finishes
    // plus the model's own baked shading. The second value is how readily
    // the finish wears through to bright metal on exposed edges.
    const finishes: Record<string, [T.MeshStandardMaterial, number]> = {
        steel: [steel, 0.45],
        paint: [paint, 0.7],
        frame: [frame, 0.5],
        anodized: [anodized, 0.6],
        black: [black, 0.15],
        signal: [signal, 0.6],
        fabric: [fabric, 0],
        foil: [foil, 0],
        copper: [copper, 0.3],
        solar: [solar, 0],
        pane: [pane, 0],
        glass: [glass, 0],
        lit: [lit, 0],
        dim: [dim, 0],
        work: [work, 0],
        amber: [amber, 0],
        beacon: [beacon, 0],
        stencil: [stencilled, 0],
        regolith: [regolith, 0],
        shield: [ceramic, 0.1],
        rotor: [rotor, 0],
        vegetation: [vegetation, 0],
        grow: [grow, 0],
    };
    const builtFinishes = new Map<string, T.MeshStandardMaterial>();
    // Dust gathers from the ground a thing stands on, wherever that is.
    const builtFinish = (name: string, ground: number) => {
        const key = `${name}@${ground.toFixed(2)}`;
        const known = builtFinishes.get(key);
        if (known) return known;
        const [base, wear] = finishes[name] ?? finishes.frame;
        const copy = base.clone();
        const dusted = homeFinishAt(ground);
        copy.onBeforeCompile = (shader) => {
            dusted(shader);
            applyHomeSurface(shader, wear);
        };
        copy.customProgramCacheKey = () => `built-${wear}`;
        builtFinishes.set(key, copy);
        return copy;
    };
    /**
     * Dresses a built model in the scene's finishes. Copies of one file share
     * its geometry, so the baked shading is renamed only once. Hardware out
     * on the plain is beyond the sun's shadow map and the contact shading.
     */
    const adopt = (model: T.Object3D, ground: number, near = true) => {
        model.traverse((child) => {
            if (!(child instanceof T.Mesh)) return;
            const geometry = child.geometry as T.BufferGeometry;
            const baked = geometry.getAttribute("color");
            if (baked) {
                geometry.setAttribute("surface", baked);
                geometry.deleteAttribute("color");
            } else if (!geometry.getAttribute("surface")) {
                // Unbaked parts are treated as open, clean and unworn.
                const open = new Float32Array(
                    geometry.getAttribute("position").count * 3,
                );
                for (let i = 0; i < open.length; i += 3) open[i] = 1;
                geometry.setAttribute(
                    "surface",
                    new T.BufferAttribute(open, 3),
                );
            }
            const source = child.material as T.Material;
            child.material = builtFinish(source.name.toLowerCase(), ground);
            const solid = near && !child.material.transparent;
            child.castShadow = solid;
            child.receiveShadow = true;
            child.userData.contactOcclusion = solid;
        });
        return model;
    };
    // A file that arrives after the scene has gone is left for collection:
    // nothing of it has reached the graphics card.
    let released = false;
    const place = ({ url, lite: lighter, x, z, heading = 0 }: Built) =>
        loadModel(lite && lighter ? lighter : url).then((model) => {
            if (released) return;
            const ground = heightAt(x, z);
            adopt(model, ground).position.set(x, ground, z);
            model.rotation.y = heading;
            settlement.add(model);
            return model;
        });
    // The main dish turns on the hub's roof about its azimuth bearing.
    let dishAz: T.Object3D | undefined,
        dishRest = 0;
    // One file serves every lander. Only the nearest keeps its propellant
    // farm, and a touch device draws that one alone.
    const fleet = loadModel(SHIP).then((model) => {
        if (released) return;
        HOME_SHIP_SITES.slice(0, lite ? 1 : undefined).forEach(
            (site, index) => {
                const ship = model.clone();
                if (index) ship.getObjectByName("farm")?.removeFromParent();
                const ground = surfaceAt(site.x, site.z);
                // The settlement group is offset; see its position below.
                adopt(ship, ground, false).position.set(
                    site.x + 2,
                    ground + PAD_RISE,
                    site.z + 8,
                );
                ship.rotation.y = site.heading;
                settlement.add(ship);
            },
        );
    });
    // The drone leaves its pad, so it joins the settlement's own frame. It
    // casts nothing: the sun's shadows are drawn once, while it is parked.
    let drone: T.Object3D | undefined, gimbal: T.Object3D | undefined;
    let strobe: T.MeshStandardMaterial | undefined,
        strobeRest = 0;
    const parked = new T.Vector3();
    let parkedYaw = 0;
    const rotors: {
        hub: T.Object3D;
        rest: number;
        spin: number;
        blades?: T.Object3D;
        disc?: T.Object3D;
    }[] = [];
    const aircraft = place(DRONE).then((model) => {
        const body = model?.getObjectByName("drone");
        if (!body) return;
        settlement.attach(body);
        parked.copy(body.position);
        const front = new T.Vector3(0, 0, 1).applyQuaternion(body.quaternion);
        parkedYaw = Math.atan2(front.x, front.z);
        body.traverse((child) => {
            child.castShadow = false;
            // Its anti-collision lamps flash; the settlement's burn steadily.
            if (child instanceof T.Mesh && child.name === "drone_beacon") {
                const steady = child.material as T.MeshStandardMaterial;
                strobe = steady.clone();
                strobe.onBeforeCompile = steady.onBeforeCompile;
                strobe.customProgramCacheKey = steady.customProgramCacheKey;
                strobeRest = steady.emissiveIntensity;
                child.material = strobe;
            }
        });
        for (let index = 1; index <= 6; index++) {
            const hub = body.getObjectByName(`rotor_${index}`);
            if (!hub) continue;
            rotors.push({
                hub,
                rest: hub.rotation.y,
                spin: Number(hub.userData.spin) || (index % 2 ? 1 : -1),
                blades: hub.getObjectByName(`rotor_${index}_black`),
                disc: hub.getObjectByName(`rotor_disc_${index}`),
            });
        }
        gimbal = body.getObjectByName("gimbal");
        body.rotation.order = "YXZ";
        drone = body;
        update(0);
    });
    const yard = place(YARD).then((model) => {
        // Each part's own origin is on the ground where that part stands.
        for (const part of model?.children ?? [])
            part.position.y =
                heightAt(YARD.x + part.position.x, YARD.z + part.position.z) -
                model!.position.y;
    });
    const ready = Promise.all([
        lettered,
        yard,
        place(OUTPOST).then((model) => {
            dishAz = model?.getObjectByName("dish_az");
            dishRest = dishAz?.rotation.y ?? 0;
        }),
        fleet,
        aircraft,
    ]);

    const mesh = (
        parent: T.Object3D,
        geometry: T.BufferGeometry,
        material: T.Material,
        x = 0,
        y = 0,
        z = 0,
    ) => {
        const object = new T.Mesh(geometry, material);
        object.position.set(x, y, z);
        object.receiveShadow = true;
        parent.add(object);
        return object;
    };
    const cylinder = (
        parent: T.Object3D,
        material: T.Material,
        x: number,
        y: number,
        z: number,
        r: number,
        h: number,
        top = r,
        sides = 24,
    ) =>
        mesh(
            parent,
            new T.CylinderGeometry(top, r, h, sides),
            material,
            x,
            y,
            z,
        );
    const batch = (group: T.Group) => {
        group.updateMatrixWorld(true);
        const buckets = new Map<T.Material, Map<string, T.BufferGeometry[]>>();
        const originals = new Set<T.BufferGeometry>();
        group.traverse((child) => {
            if (!(child instanceof T.Mesh) || Array.isArray(child.material))
                return;
            const geometry = child.geometry.index
                ? child.geometry.toNonIndexed()
                : child.geometry.clone();
            geometry.applyMatrix4(child.matrixWorld);
            geometry.computeBoundingBox();
            const center = geometry.boundingBox!.getCenter(new T.Vector3());
            // Keep the settlement and distant launch site independently
            // cullable without fragmenting each structure into many draws.
            const key = `${Math.floor((center.x + 30) / 60)},${Math.floor((center.z + 40) / 60)}`;
            const cells =
                buckets.get(child.material) ??
                new Map<string, T.BufferGeometry[]>();
            const parts = cells.get(key) ?? [];
            parts.push(geometry);
            cells.set(key, parts);
            buckets.set(child.material, cells);
            originals.add(child.geometry);
        });
        group.clear();
        for (const [material, cells] of buckets)
            for (const parts of cells.values()) {
                const geometry = mergeGeometries(parts, false);
                if (geometry) {
                    geometry.computeBoundingSphere();
                    const result = mesh(group, geometry, material);
                    const solid = group === buildings && !material.transparent;
                    result.castShadow = solid;
                    result.userData.contactOcclusion = solid;
                }
                parts.forEach((part) => part.dispose());
            }
        originals.forEach((geometry) => geometry.dispose());
    };

    // A cable way to the rover's ground, marked by low amber stakes.
    const route = new T.CatmullRomCurve3(
        HOME_CABLE_WAY.map(([x, z]) => new T.Vector3(x + 2, 0, z + 8)),
    );
    for (let side = -1; side <= 1; side += 2) {
        const points = route.getPoints(90).map((sample, index) => {
            const tangent = route.getTangent(index / 90);
            sample.x += tangent.z * side * 0.7;
            sample.z -= tangent.x * side * 0.7;
            sample.y = heightAt(sample.x, sample.z) + 0.04;
            return sample;
        });
        mesh(
            buildings,
            new T.TubeGeometry(
                new T.CatmullRomCurve3(points),
                90,
                0.022,
                4,
                false,
            ),
            copper,
        );
        points.forEach((sample, index) => {
            if (index % 9) return;
            cylinder(
                buildings,
                anodized,
                sample.x,
                sample.y + 0.22,
                sample.z,
                0.016,
                0.44,
                0.016,
                6,
            );
            cylinder(
                buildings,
                amber,
                sample.x,
                sample.y + 0.46,
                sample.z,
                0.03,
                0.06,
                0.03,
                8,
            );
        });
    }

    batch(buildings);

    // The round the drone flies, measured out once: where it is after any
    // number of seconds, given that it slows for the things it surveys.
    const survey = (() => {
        const stops = SURVEY.length,
            steps = stops * 60;
        const course = new T.CatmullRomCurve3(
            SURVEY.map(
                ([x, z, height]) =>
                    new T.Vector3(x, heightAt(x, z) + height, z),
            ),
            true,
            "centripetal",
        );
        course.arcLengthDivisions = steps;
        const lengths = course.getLengths(steps),
            length = lengths[steps];
        const around = (from: number, to: number) => {
            const apart = Math.abs(from - to);
            return Math.min(apart, length - apart);
        };
        /** How near a stretch of the round is to each stop that matters. */
        const near = (along: number, which: 3 | 4, reach: number) =>
            SURVEY.map((stop, index) => {
                const apart = around(along, lengths[index * 60]) / reach;
                return [stop[which], Math.exp(-apart * apart)] as const;
            });
        const clock = new Float32Array(steps + 1),
            pace = new Float32Array(steps + 1),
            sweeps = new Float32Array(steps + 1);
        for (let step = 0; step <= steps; step++) {
            const along = (step / steps) * length;
            pace[step] = near(along, 3, 2.4).reduce(
                (slowest, [share, weight]) =>
                    Math.min(slowest, 1 - (1 - share) * weight),
                1,
            );
            sweeps[step] = near(along, 4, 3.6).reduce(
                (most, [sweeping, weight]) => Math.max(most, sweeping * weight),
                0,
            );
            if (step)
                clock[step] =
                    clock[step - 1] +
                    (length / steps / SURVEY_SPEED) *
                        (2 / (pace[step] + pace[step - 1]));
        }
        const period = clock[steps];
        const read = (table: Float32Array, at: number) => {
            const step = Math.min(steps - 1, Math.floor(at));
            return T.MathUtils.lerp(table[step], table[step + 1], at - step);
        };
        return {
            /** Fills in the place and the heading after `seconds` of flying. */
            at(seconds: number, place: T.Vector3, heading: T.Vector3) {
                const elapsed = ((seconds % period) + period) % period;
                let low = 0,
                    high = steps;
                while (high - low > 1) {
                    const middle = (low + high) >> 1;
                    if (clock[middle] <= elapsed) low = middle;
                    else high = middle;
                }
                const at =
                    low +
                    (elapsed - clock[low]) / (clock[high] - clock[low] || 1);
                course.getPointAt(at / steps, place);
                course.getTangentAt(at / steps, heading);
                return {
                    speed: SURVEY_SPEED * read(pace, at),
                    sweeping: read(sweeps, at),
                };
            },
        };
    })();

    // The instrument's fan of light, drawn where the dust in the air catches
    // it. Whatever it reaches stops it, and each surface draws the line.
    const fanGeometry = new T.BufferGeometry();
    {
        const corners: number[] = [],
            across: number[] = [],
            arcs = 32,
            reach = 40;
        for (let arc = 0; arc < arcs; arc++)
            for (const end of [arc, arc + 1, -1]) {
                const turn = (end / arcs) * 2 - 1,
                    angle = turn * SURVEY_SPREAD;
                if (end < 0) {
                    corners.push(0, 0, 0);
                    across.push(((arc + 0.5) / arcs) * 2 - 1, 0);
                } else {
                    corners.push(
                        Math.sin(angle) * reach,
                        -Math.cos(angle) * reach,
                        0,
                    );
                    across.push(turn, 1);
                }
            }
        fanGeometry.setAttribute(
            "position",
            new T.Float32BufferAttribute(corners, 3),
        );
        fanGeometry.setAttribute("uv", new T.Float32BufferAttribute(across, 2));
    }
    const fanMaterial = new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
        blending: T.AdditiveBlending,
        uniforms: {
            strength: { value: 0 },
            tint: { value: new T.Color().fromArray(HOME_SCAN_COLOR) },
        },
        vertexShader: `varying vec2 vFan; void main(){vFan=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `uniform float strength; uniform vec3 tint; varying vec2 vFan;
            void main(){
                // Separate beams near the instrument, one sheet farther out,
                // brightest along its two edges and gone within its reach.
                float beams=.7+.3*smoothstep(.2,.8,abs(fract(vFan.x*36.)-.5)*2.);
                float edges=.35+.65*pow(abs(vFan.x),8.);
                float far=smoothstep(0.,.012,vFan.y)*pow(1.-vFan.y,3.);
                float alpha=strength*.065*beams*edges*far;
                if(alpha<.0015) discard;
                gl_FragColor=vec4(tint*alpha,1.);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }`,
    });
    const fan = new T.Mesh(fanGeometry, fanMaterial);
    fan.matrixAutoUpdate = false;
    fan.frustumCulled = false;
    fan.visible = false;
    root.add(fan);

    const spot = new T.Vector3(),
        heading = new T.Vector3(),
        ahead = new T.Vector3(),
        aheadHeading = new T.Vector3(),
        instrument = new T.Vector3(),
        level = new T.Vector3(),
        across = new T.Vector3(),
        axis = new T.Vector3(),
        normal = new T.Vector3();
    const UP = new T.Vector3(0, 1, 0);
    function update(time: number) {
        // It tracks slowly enough that its shadow, drawn once, stays true.
        if (dishAz)
            dishAz.rotation.y = dishRest + Math.sin(time * 0.055) * 0.05;
        if (!drone) return;
        // The drone lifts straight off its pad, then leaves on its round. A
        // scene that never moves keeps it on the ground, where it reads.
        const { smoothstep, lerp, clamp } = T.MathUtils;
        const climb = smoothstep(time, 0.4, 3.2),
            away = smoothstep(time, 1.6, 4.6),
            flying = Math.max(0, time - 1.6);
        const { speed, sweeping } = survey.at(flying, spot, heading);
        survey.at(flying + 0.4, ahead, aheadHeading);
        const yaw = Math.atan2(heading.x, heading.z),
            turning =
                Math.atan2(
                    heading.z * aheadHeading.x - heading.x * aheadHeading.z,
                    heading.x * aheadHeading.x + heading.z * aheadHeading.z,
                ) / 0.4;
        drone.position.set(
            lerp(parked.x, spot.x, away),
            lerp(parked.y, spot.y + Math.sin(time * 0.9) * 0.05, climb),
            lerp(parked.z, spot.z, away),
        );
        // It leans into its speed and banks into its turns: there is a
        // third of the Earth's weight to turn against.
        const swing = Math.atan2(
            Math.sin(yaw - parkedYaw),
            Math.cos(yaw - parkedYaw),
        );
        drone.rotation.set(
            (speed * 0.07 + Math.sin(time * 0.7) * 0.012) * away,
            parkedYaw + swing * away,
            (clamp((-turning * speed) / 3.71, -0.4, 0.4) +
                Math.sin(time * 0.53) * 0.012) *
                away,
        );
        // Blades show while the eye could follow them; at speed each rotor
        // is the faint disc it sweeps. Neighbours turn against each other.
        // The blur turns slowly enough to follow, as a camera would see it.
        const spun = Math.max(0, time - 0.4);
        for (const rotor of rotors) {
            rotor.hub.rotation.y =
                rotor.rest + rotor.spin * Math.min(spun * spun * 9, spun * 9);
            if (rotor.blades) rotor.blades.visible = spun < 0.5;
            if (rotor.disc) rotor.disc.visible = spun >= 0.5;
        }
        // Two quick flashes, then dark, as aircraft lamps do.
        if (strobe) {
            const beatAt = (time * 0.8) % 1,
                flash =
                    time > 0.2 &&
                    (beatAt < 0.06 || (beatAt > 0.14 && beatAt < 0.2));
            strobe.emissiveIntensity = strobeRest * (flash ? 3.2 : 0.2);
        }

        // The instrument looks straight down as the drone travels, laying a
        // swath across its track, and rocks the fan fore and aft over what
        // it has slowed to survey. Its mount keeps the fan level whatever
        // the airframe is doing.
        const rock = sweeping * 0.62,
            beat = time * 1.75,
            tilt = rock * Math.sin(beat);
        drone.updateWorldMatrix(true, true);
        (gimbal ?? drone).getWorldPosition(instrument);
        level.set(heading.x, 0, heading.z).normalize();
        across.crossVectors(UP, level);
        axis.copy(UP)
            .multiplyScalar(-Math.cos(tilt))
            .addScaledVector(level, Math.sin(tilt));
        normal
            .copy(level)
            .multiplyScalar(Math.cos(tilt))
            .addScaledVector(UP, Math.sin(tilt));
        const working = away * (0.6 + 0.4 * sweeping);
        const above = Math.max(1, instrument.y - heightAt(spot.x, spot.z));
        HOME_SURVEY.homeScanFrom.value.set(
            instrument.x,
            instrument.y,
            instrument.z,
            working,
        );
        HOME_SURVEY.homeScanPlane.value.set(
            normal.x,
            normal.y,
            normal.z,
            clamp((speed + above * rock * 1.75 * Math.cos(beat)) / 1.5, -1, 1),
        );
        HOME_SURVEY.homeScanAxis.value.set(
            axis.x,
            axis.y,
            axis.z,
            Math.cos(SURVEY_SPREAD),
        );
        drone.getWorldPosition(level);
        HOME_SURVEY.homeFlyer.value.set(level.x, level.y + 0.72, level.z, 1);
        fan.visible = working > 0.01;
        fanMaterial.uniforms.strength.value = working;
        axis.negate();
        fan.matrix.makeBasis(across, axis, normal).setPosition(instrument);
        fan.matrixWorldNeedsUpdate = true;
        if (gimbal) gimbal.rotation.y = Math.sin(time * 0.37) * 0.35 * away;
    }
    // Apply after batching: the merged vertices remain in settlement space.
    settlement.position.set(-2, 0, -8);
    update(0);
    return {
        root,
        update,
        ready,
        release() {
            released = true;
            HOME_SURVEY.homeScanFrom.value.w = 0;
            HOME_SURVEY.homeFlyer.value.w = 0;
        },
    };
}
