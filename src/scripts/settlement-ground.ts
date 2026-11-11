import type * as Three from "three";
import type { HomeFloor } from "./home-floor";
import type { SettlementAir } from "./settlement-air";

/**
 * The ground a settlement stands on. One map of the whole site says where
 * the craters or ripple fields are, where the town has graded and rutted the
 * soil, how much sky its hardware leaves each spot and how much sun the
 * relief does; one small square of soil repeats under it. Both are made by
 * scripts/artwork/make-settlement-ground.mjs.
 */
export interface SettlementSite {
    /** Metres along a side of the site maps, centred on the settlement. */
    metres: number;
    /** The range the site's slopes are stored over. */
    steepest: number;
    /** Where the site maps fade to plain ground, in metres from the centre. */
    reach: [number, number];
    /** Stencilled designations, top row of the atlas first. */
    labels: string[];
    /** Toward the sun the maps were shaded under, in the settlement's axes. */
    sun?: [number, number, number];
    /** Each named structure, at the top of it, in the settlement's metres. */
    landmarks?: SettlementLandmark[];
    /**
     * How tall the solid hardware stands over each square of the site: one
     * byte a square, row by row from the least z and x, in base64. A byte
     * times `step` is metres.
     */
    heights?: { cells: number; step: number; data: string };
}

export interface SettlementLandmark {
    /** Its key in `settlement-places`, which says what it is. */
    name: string;
    x: number;
    y: number;
    z: number;
}

export interface SettlementMaps {
    /** Red: open sky. Green: worked ground. Blue: sun past the relief. */
    site: Three.Texture;
    /** Red and green: slope along x and z. Blue: lighter or darker soil. */
    relief: Three.Texture;
    /** The repeating square: its slopes and shade, and its colour. */
    soil: HomeFloor;
}

type World = "moon" | "mars";

/**
 * Where the drawn ground gives way to the globe beneath it, in metres. The
 * globe's own picture was made to be seen from orbit and is a blur from a
 * rooftop, so the drawn ground runs on past the horizon of every view the
 * tours take: about 430 m from a camera 58 m up on a globe this small.
 */
export const SETTLEMENT_GROUND_EDGE = [480, 570] as const;

/**
 * How each world's soil is drawn: its colour in sunlight, the square that
 * repeats (its side, the range of its slopes, its mean colour) and the turn
 * that lines the square's own baked shade up with this world's sun.
 */
export const SETTLEMENT_SOIL: Record<
    World,
    {
        tint: [number, number, number];
        worked: [number, number, number];
        metres: number;
        steepest: number;
        mean: [number, number, number];
        turn: number;
        /** The second, larger copy: how much larger, and its share. */
        wide: { scale: number; colour: number; slope: number };
        /**
         * Craters too small or too far out for the site's map, in squares of
         * 3, 9, 27 and 82 m: the share of each size's squares that hold one,
         * and how worn the freshest of them is (0 sharp, 1 gone).
         */
        craters: { share: [number, number, number, number]; worn: number };
        /**
         * Loose rock, in squares of 0.9 and 3.1 m: the share that hold one,
         * and how much darker than the soil a rock is.
         */
        rocks: { share: [number, number]; dark: number };
    }
> = {
    moon: {
        tint: [0.15, 0.15, 0.154],
        worked: [0.128, 0.128, 0.132],
        metres: 12,
        steepest: 2.5,
        mean: [0.296, 0.296, 0.296],
        turn: 0,
        // Craters drawn large read as craters, so this copy stays faint.
        wide: { scale: 3.7, colour: 0.25, slope: 0.3 },
        // Nothing wears a crater away here but more craters.
        craters: { share: [0.5, 0.5, 0.42, 0.34], worn: 0 },
        // Blocks thrown out of the larger craters, the soil's own colour.
        rocks: { share: [0.07, 0.05], dark: 0.06 },
    },
    mars: {
        // Iron-red and darker than what is built on it, so the town reads
        // against its ground and not as part of it.
        tint: [0.235, 0.118, 0.066],
        worked: [0.17, 0.092, 0.056],
        metres: 8,
        steepest: 2.5,
        mean: [0.262, 0.212, 0.159],
        // The homepage's floor was shaded for its own sun; turned this far,
        // that shade falls the way this world's sun throws it.
        turn: 1.4695,
        wide: { scale: 5.3, colour: 0.4, slope: 0.5 },
        // Wind fills them in: few are left, and none is sharp.
        craters: { share: [0.02, 0.05, 0.12, 0.2], worn: 0.5 },
        // A plain of dark basalt blocks standing out of bright dust.
        rocks: { share: [0.42, 0.3], dark: 0.4 },
    },
};

export function makeSettlementGround(
    T: typeof Three,
    world: World,
    site: SettlementSite,
    maps: SettlementMaps,
    curve: (point: Three.Vector3) => Three.Vector3,
    fine: boolean,
    air: SettlementAir,
) {
    const soil = SETTLEMENT_SOIL[world];
    const rings = fine ? 128 : 72,
        spokes = fine ? 176 : 96,
        radius = SETTLEMENT_GROUND_EDGE[1];
    const positions = new Float32Array((rings * spokes + 1) * 3),
        normals = new Float32Array(positions.length),
        indices: number[] = [];
    const point = new T.Vector3(),
        beside = new T.Vector3(),
        up = new T.Vector3();
    const put = (at: number, x: number, z: number) => {
        curve(point.set(x, 0, z)).toArray(positions, at * 3);
        // The globe's own normal there, from two neighbours on its surface.
        curve(beside.set(x + 1, 0, z));
        curve(up.set(x, 0, z + 1));
        beside.sub(point);
        up.sub(point)
            .cross(beside)
            .normalize()
            .toArray(normals, at * 3);
    };
    put(0, 0, 0);
    for (let ring = 1; ring <= rings; ring++)
        for (let spoke = 0; spoke < spokes; spoke++) {
            // Rings crowd toward the middle, where the camera looks closest.
            const out = radius * (ring / rings) ** 1.25,
                turn = (spoke / spokes) * Math.PI * 2;
            put(
                1 + (ring - 1) * spokes + spoke,
                Math.cos(turn) * out,
                Math.sin(turn) * out,
            );
        }
    for (let spoke = 0; spoke < spokes; spoke++)
        indices.push(0, 1 + ((spoke + 1) % spokes), 1 + spoke);
    for (let ring = 1; ring < rings; ring++)
        for (let spoke = 0; spoke < spokes; spoke++) {
            const a = 1 + (ring - 1) * spokes + spoke,
                b = 1 + (ring - 1) * spokes + ((spoke + 1) % spokes),
                c = a + spokes,
                d = b + spokes;
            indices.push(a, b, c, b, d, c);
        }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new T.BufferAttribute(normals, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();

    const material = new T.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 1,
        metalness: 0,
        transparent: true,
    });
    material.name = `${world} regolith`;
    const number = (value: number) => value.toFixed(5);
    const triple = (value: readonly number[]) =>
        `vec3(${value.map(number).join(",")})`;
    // The height of the picture in pixels, kept current as it is drawn.
    const view = { value: 1080 },
        drawn = new T.Vector2();
    // Each size is dropped before what it draws is smaller than a few
    // pixels. Inside the site's map only the two smallest sizes of crater
    // are drawn: the map has the large ones, where the town left them. A
    // lighter build leaves out the smallest craters and the rocks.
    const shown = (cell: number) =>
        `smoothstep(7., 22., ${number(cell)} / plainPixel)`;
    const craterLayers = [3, 9, 27, 82]
        .map((cell, index) =>
            fine || index > 0
                ? `plainCraters(vGround, ${number(cell)}, ${number(index * 31.7 + 5)}, ${number(soil.craters.share[index])}, ${number(soil.craters.worn)}) * ${shown(cell)}${index > 1 ? " * plain" : ""}`
                : "",
        )
        .filter(Boolean)
        .join("\n                    + ");
    const rockLayers = fine
        ? [0.9, 3.1]
              .map(
                  (cell, index) =>
                      `plainRocks(vGround, ${number(cell)}, ${number(index * 19.3 + 71)}, ${number(soil.rocks.share[index])}) * ${shown(cell)}`,
              )
              .join("\n                    + ")
        : "vec3(0.)";
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, {
            groundView: view,
            siteMap: { value: maps.site },
            siteRelief: { value: maps.relief },
            soilShape: { value: maps.soil.relief },
            soilColour: { value: maps.soil.colour },
        });
        shader.vertexShader = shader.vertexShader
            .replace(
                "#include <common>",
                `#include <common>
                varying vec2 vGround;
                varying vec3 vGroundX;
                varying vec3 vGroundZ;`,
            )
            .replace(
                "#include <begin_vertex>",
                `#include <begin_vertex>
                vGround = position.xz;
                vGroundX = normalize(normalMatrix * vec3(1., 0., 0.));
                vGroundZ = normalize(normalMatrix * vec3(0., 0., 1.));`,
            );
        shader.fragmentShader = shader.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
                uniform sampler2D siteMap;
                uniform sampler2D siteRelief;
                uniform sampler2D soilShape;
                uniform sampler2D soilColour;
                uniform float groundView;
                varying vec2 vGround;
                varying vec3 vGroundX;
                varying vec3 vGroundZ;
                // The same on every graphics card, which sin() is not.
                float plainHash(vec2 cell) {
                    vec3 mixed = fract(vec3(cell.xyx) * .1031);
                    mixed += dot(mixed, mixed.yzx + 33.33);
                    return fract((mixed.x + mixed.y) * mixed.z);
                }
                float plainCloud(vec2 at) {
                    vec2 cell = floor(at), part = fract(at);
                    part = part * part * (3. - 2. * part);
                    return mix(
                        mix(plainHash(cell), plainHash(cell + vec2(1., 0.)), part.x),
                        mix(plainHash(cell + vec2(0., 1.)), plainHash(cell + vec2(1.)), part.x),
                        part.y);
                }
                // Impact craters of one size: at most one to a square of
                // that many metres. Returns the ground's slope there (rise per
                // metre along the plan's two axes) and, third, how much
                // brighter fresh ejecta makes it. Nothing a crater does
                // reaches more than half a square past its own, so only the
                // nearer neighbour each way is looked at.
                vec3 plainCraters(vec2 at, float cell, float seed, float share, float worn) {
                    vec2 home = floor(at / cell), within = at / cell - home;
                    vec2 side = step(.5, within) * 2. - 1.;
                    vec3 sum = vec3(0.);
                    for (int corner = 0; corner < 4; corner++) {
                        vec2 next = vec2(mod(float(corner), 2.), floor(float(corner) * .5)) * side;
                        vec2 id = home + next + seed;
                        if (plainHash(id + 3.7) > share) continue;
                        vec2 centre = next + .3 + .4 * vec2(plainHash(id), plainHash(id + 17.3));
                        float age = mix(worn, 1., plainHash(id + 9.1));
                        float size = mix(.09, .3, pow(plainHash(id + 5.3), 2.2));
                        vec2 from = within - centre;
                        float far = length(from);
                        float q = far / size;
                        vec2 away = from / max(far, 1e-5);
                        // A bowl that steepens to its rim, the rim's own
                        // outer bank, and the apron thrown out beyond it.
                        float steep = mix(.6, .14, age);
                        float wall = steep * q * (1. - smoothstep(.84, 1.04, q));
                        float bank = -steep * .34 * smoothstep(.94, 1.06, q) * exp(-(q - 1.) * 3.2);
                        sum.xy += away * (wall + bank);
                        sum.z += (1. - age) * (1. - age) * .22 * smoothstep(2.2, 1., q) * smoothstep(.5, 1., q);
                    }
                    return sum;
                }
                // Loose rocks of one size, the same way: the slope of each
                // one's rounded top, and third, how much of it is rock.
                vec3 plainRocks(vec2 at, float cell, float seed, float share) {
                    vec2 home = floor(at / cell), within = at / cell - home;
                    vec2 side = step(.5, within) * 2. - 1.;
                    vec3 sum = vec3(0.);
                    for (int corner = 0; corner < 4; corner++) {
                        vec2 next = vec2(mod(float(corner), 2.), floor(float(corner) * .5)) * side;
                        vec2 id = home + next + seed;
                        if (plainHash(id + 3.7) > share) continue;
                        vec2 centre = next + .3 + .4 * vec2(plainHash(id), plainHash(id + 17.3));
                        float size = mix(.07, .3, pow(plainHash(id + 5.3), 3.));
                        // No rock is round: each is longer one way.
                        float lean = plainHash(id + 11.9) * 3.1416;
                        vec2 along = vec2(cos(lean), sin(lean));
                        vec2 from = within - centre;
                        from += along * dot(from, along) * (plainHash(id + 2.3) - .2);
                        float far = length(from);
                        float q = far / size;
                        sum.xy -= from / max(far, 1e-5) * 1.5 * q * (1. - smoothstep(.8, 1., q));
                        sum.z += 1. - smoothstep(.78, 1., q);
                    }
                    return sum;
                }`,
            )
            .replace(
                "#include <map_fragment>",
                `#include <map_fragment>
                // Every lookup is taken on every fragment: a lookup inside
                // a branch has no usable derivative at the branch's edge.
                vec2 siteUv = vGround / ${number(site.metres)} + .5;
                vec4 siteAt = texture2D(siteMap, siteUv);
                vec4 reliefAt = texture2D(siteRelief, siteUv);
                vec2 turned = vec2(
                    ${number(Math.cos(soil.turn))} * vGround.x + ${number(Math.sin(soil.turn))} * vGround.y,
                    ${number(-Math.sin(soil.turn))} * vGround.x + ${number(Math.cos(soil.turn))} * vGround.y);
                vec2 nearUv = turned / ${number(soil.metres)};
                // The same square again, larger and a quarter turn round,
                // so no one repeat can be followed across the plain.
                vec2 wideUv = vec2(turned.y, -turned.x) / ${number(soil.metres * soil.wide.scale)} + .37;
                vec4 nearShape = texture2D(soilShape, nearUv);
                vec4 wideShape = texture2D(soilShape, wideUv);
                vec3 nearSoil = texture2D(soilColour, nearUv).rgb;
                vec3 wideSoil = texture2D(soilColour, wideUv).rgb;
                float groundOut = length(vGround);
                float mapped = 1. - smoothstep(${number(site.reach[0])}, ${number(site.reach[1])}, groundOut);
                float worked = siteAt.g * mapped;
                float tone = (reliefAt.b - .502) * mapped;
                // A square seen small repeats in plain sight. Each copy is
                // drawn only where it covers a good part of the picture, and
                // gives way to the site's own map beyond that.
                float nearShow = smoothstep(.2, .62, 1. / (max(length(fwidth(nearUv)), 1e-6) * groundView));
                float wideShow = smoothstep(.2, .62, 1. / (max(length(fwidth(wideUv)), 1e-6) * groundView));
                vec3 grain = mix(
                    mix(vec3(1.), nearSoil / ${triple(soil.mean)}, nearShow),
                    mix(vec3(1.), wideSoil / ${triple(soil.mean)}, wideShow),
                    ${number(soil.wide.colour)});
                // Graded soil is finer, flatter and a shade darker.
                grain = mix(grain, vec3(dot(grain, vec3(.333))), .5 * worked);
                diffuseColor.rgb *= mix(${triple(soil.tint)}, ${triple(soil.worked)}, worked)
                    * mix(vec3(1.), grain, 1. - .45 * worked)
                    * (1. + 1.7 * tone);
                vec2 nearSlope = (nearShape.rg - .502) * ${number(2.008 * soil.steepest)};
                vec2 wideSlope = (wideShape.rg - .502) * ${number(2.008 * soil.steepest)};
                // Back from the square's own axes to the settlement's.
                nearSlope = vec2(
                    ${number(Math.cos(soil.turn))} * nearSlope.x - ${number(Math.sin(soil.turn))} * nearSlope.y,
                    ${number(Math.sin(soil.turn))} * nearSlope.x + ${number(Math.cos(soil.turn))} * nearSlope.y);
                wideSlope = vec2(-wideSlope.y, wideSlope.x);
                wideSlope = vec2(
                    ${number(Math.cos(soil.turn))} * wideSlope.x - ${number(Math.sin(soil.turn))} * wideSlope.y,
                    ${number(Math.sin(soil.turn))} * wideSlope.x + ${number(Math.cos(soil.turn))} * wideSlope.y);
                vec2 groundSlope = (reliefAt.rg - .502) * ${number(2.008 * site.steepest)} * mapped
                    + (nearSlope * .55 * nearShow + wideSlope * ${number(soil.wide.slope)} * wideShow) * (1. - .7 * worked);
                // Ground the town has not graded is cratered and strewn
                // with rock, and past the site's own map it is never one
                // tone.
                float plainPixel = sqrt(max(length(dFdx(vGround)) * length(dFdy(vGround)), 1e-8));
                float plain = 1. - mapped;
                float wild = 1. - worked;
                vec3 pocked = ${craterLayers};
                vec3 strewn = ${rockLayers};
                float rock = min(strewn.z, 1.) * wild;
                float mottled = plainCloud(vGround / 64.) * .55 + plainCloud(vGround / 210. + 7.) * .45;
                diffuseColor.rgb *= mix(1., .87 + .26 * mottled, plain)
                    * (1. + pocked.z * wild)
                    * (1. - ${number(soil.rocks.dark)} * rock);
                groundSlope = mix(groundSlope, vec2(0.), rock) + (pocked.xy + strewn.xy) * wild;
                float groundOpen = mix(1., siteAt.r, mapped);
                float groundLit = mix(1., siteAt.b, mapped) * mix(1., nearShape.b, .7 * nearShow * (1. - .7 * worked));
                diffuseColor.a *= 1. - smoothstep(${number(SETTLEMENT_GROUND_EDGE[0])}, ${number(SETTLEMENT_GROUND_EDGE[1])}, groundOut);`,
            )
            .replace(
                "#include <normal_fragment_maps>",
                `#include <normal_fragment_maps>
                normal = normalize(normal - groundSlope.x * vGroundX - groundSlope.y * vGroundZ);`,
            )
            .replace(
                "#include <aomap_fragment>",
                `#include <aomap_fragment>
                reflectedLight.indirectDiffuse *= groundOpen;
                // A shadow map this wide cannot hold the dark under a
                // cradle or a pipe run, so the baked shade takes some sun.
                float groundSun = groundLit * mix(1., groundOpen, .45);
                reflectedLight.directDiffuse *= groundSun;
                reflectedLight.directSpecular *= groundSun;`,
            );
        air.inject(shader);
    };
    material.customProgramCacheKey = () =>
        `settlement-ground-${world}-${fine ? "fine" : "plain"}-v4`;
    const mesh = new T.Mesh(geometry, material);
    mesh.onBeforeRender = (renderer) => {
        view.value = renderer.getDrawingBufferSize(drawn).y;
    };
    mesh.name = "Settlement ground";
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    return mesh;
}
