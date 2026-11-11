import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { ImprovedNoise } from "three/addons/math/ImprovedNoise.js";
import {
    mergeVertices,
    toCreasedNormals,
} from "three/addons/utils/BufferGeometryUtils.js";
import { homeCoverFrame, type HomeFraming } from "../lib/home-framing";
import {
    HOME_CABLE_WAY,
    HOME_SHIP_GRADE,
    HOME_SHIP_HULL,
    HOME_SHIP_SITES,
    HOME_YARD_GROUND,
    makeHomeFrontier,
} from "./home-frontier";
import {
    HOME_BEDS,
    HOME_BEDS_GLSL,
    makeHomeBeds,
    makeHomeShadow,
} from "./home-relief";
import { makeHomeRendering } from "./home-rendering";
import { makeTerrainGrid, tileTerrain } from "./landscape-geometry";
import {
    HOME_TERRAIN_BROAD,
    HOME_TERRAIN_FINE,
    type HomeTerrain,
    HOME_SITE,
} from "./home-terrain";
import {
    applyHomeFinish,
    applyHomeHaze,
    HOME_HAZE_COLOR,
    HOME_HAZE_DENSITY,
    HOME_HAZE_HEIGHT,
    HOME_SKY_GLSL,
    HOME_SUN_COLOR,
    HOME_SUN_DIRECTION,
    makeHomeEnvironment,
} from "./home-lighting";
import { HOME_FLOOR, loadHomeFloor, plainHomeFloor } from "./home-floor";
import { isSoftwareRenderer, rendererName } from "../lib/renderer-kind";

/**
 * The way the rover came, in metres: straight back from its front wheels
 * (`front`) to where it turned (`bend`), round a bend of the given radius
 * and angle toward the settlement, then straight on. Its two ruts stand
 * `gauge` apart and are lost to the wind between the `fades` distances.
 */
const TRACK = {
    x: 2,
    front: 2.05,
    bend: -4,
    radius: 9,
    turn: 0.586,
    gauge: 3,
    fades: [16, 24],
};
const TRACK_END = {
    // Where the bend gives way to the last straight, and that straight's
    // outward and onward directions.
    x: TRACK.x - TRACK.radius + TRACK.radius * Math.cos(TRACK.turn),
    z: TRACK.bend - TRACK.radius * Math.sin(TRACK.turn),
    outX: Math.cos(TRACK.turn),
    outZ: -Math.sin(TRACK.turn),
    first: TRACK.front - TRACK.bend,
};
/** How far along the rover's way a place is, and how far to one side. */
const trackAt = (x: number, z: number) => {
    if (z > TRACK.bend) return { along: TRACK.front - z, across: x - TRACK.x };
    const fromX = x - (TRACK.x - TRACK.radius),
        fromZ = z - TRACK.bend,
        pastX = x - TRACK_END.x,
        pastZ = z - TRACK_END.z,
        past = pastX * TRACK_END.outZ - pastZ * TRACK_END.outX;
    return past > 0
        ? {
              along: TRACK_END.first + TRACK.radius * TRACK.turn + past,
              across: pastX * TRACK_END.outX + pastZ * TRACK_END.outZ,
          }
        : {
              along:
                  TRACK_END.first +
                  TRACK.radius * Math.atan2(-fromZ, Math.max(fromX, 1e-3)),
              across: Math.hypot(fromX, fromZ) - TRACK.radius,
          };
};
const metres = (value: number) => value.toFixed(4);
const SET_STONES: readonly [
    x: number,
    z: number,
    size: number,
    turn: number,
][] = [
    [7.6, 2.4, 0.42, 0.7],
    [4.6, 5.2, 0.26, 2.1],
    [8.5, -4, 0.34, 4.0],
];

// The composed view and freely explorable scene share the same real geometry.
export function makeHomeLandscape(
    renderer: T.WebGLRenderer,
    terrain: HomeTerrain,
) {
    const scene = new T.Scene();
    // The crater floor is visible for kilometres before the haze closes.
    const camera = new T.PerspectiveCamera(34, 1, 0.1, 20000);
    const textures = new Set<T.Texture>();
    let disposed = false;
    const noise = new ImprovedNoise();
    let seed = 61;
    const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    // Relief finer than the orbital data's 2 m posts, near the scene only.
    const fineRelief = (x: number, z: number) =>
        noise.noise(x * 0.24, z * 0.24, 11) * 0.11 +
        noise.noise(x * 0.8, z * 0.8, 4) * 0.045;
    // The rover's patch, the outpost's pad and each landing site are graded
    // level, as a crew would grade them. Everything else is the crater floor
    // as measured.
    const roverLevel = terrain.heightAt(2, 0) - 0.03,
        padLevel = terrain.heightAt(-10, -31) - 0.15;
    const landings = HOME_SHIP_SITES.map(({ x, z }) => ({
        x,
        z,
        level: terrain.heightAt(x, z),
    }));
    const heightAt = (x: number, z: number) => {
        const open = T.MathUtils.smoothstep(Math.hypot(x - 2, z), 3.4, 9);
        const district =
            1 -
            T.MathUtils.smoothstep(Math.hypot((x + 10) / 1.25, z + 31), 12, 22);
        const near =
            1 - T.MathUtils.smoothstep(Math.hypot(x, z + 30), 200, 420);
        let ground = terrain.heightAt(x, z) + fineRelief(x, z) * near;
        for (const landing of landings) {
            const away = Math.hypot(x - landing.x, z - landing.z);
            if (away < HOME_SHIP_GRADE.natural)
                ground = T.MathUtils.lerp(
                    landing.level,
                    ground,
                    T.MathUtils.smoothstep(
                        away,
                        HOME_SHIP_GRADE.level,
                        HOME_SHIP_GRADE.natural,
                    ),
                );
        }
        // The yard beyond the pad is levelled to the pad's own height.
        let levelled = district;
        for (const yard of HOME_YARD_GROUND)
            levelled = Math.max(
                levelled,
                1 -
                    T.MathUtils.smoothstep(
                        Math.hypot(x - yard.x, z - yard.z),
                        yard.level,
                        yard.natural,
                    ),
            );
        return T.MathUtils.lerp(
            T.MathUtils.lerp(roverLevel, ground, open),
            padLevel,
            levelled,
        );
    };
    // The butte's beds are cut into the ground it was measured as. Built
    // things stand on the measured ground; only loose rock needs the cut.
    const beds = makeHomeBeds(terrain.heightAt, noise);
    const carvedAt = (x: number, z: number) =>
        heightAt(x, z) + beds.at(x, z).cut;
    // A phone, and a browser drawing without graphics hardware, get the
    // lighter set of everything: fewer triangles, smaller maps, and for the
    // second no filtering across the ground's long view, which alone costs
    // such a renderer more than the rest of the frame.
    const software = isSoftwareRenderer(rendererName(renderer.getContext()));
    const coarse = matchMedia("(pointer: coarse)").matches || software;
    const anisotropy = software
        ? 1
        : Math.min(8, renderer.capabilities.getMaxAnisotropy());
    // The low sun's shadow over everything the nearer ground meshes cover,
    // out past the landers. Each is too far for the sun's shadow map and
    // too tall to stand without one, so its hull joins the ground here: a
    // column a few posts wide that throws a streak down the plain. A touch
    // device draws only the nearest.
    const standing = landings.slice(0, coarse ? 1 : undefined);
    const shadow = makeHomeShadow(
        { left: -640, right: 440, back: -800, front: 310 },
        (x, z) => {
            for (const lander of standing)
                if (
                    Math.hypot(x - lander.x, z - lander.z) <
                    HOME_SHIP_HULL.radius
                )
                    return lander.level + HOME_SHIP_HULL.height;
            return carvedAt(x, z);
        },
        terrain.heightAt,
    );
    // Distance fades into the horizon behind it; materials refine this flat
    // colour by direction so ridges toward the sun glow and the rest cool.
    scene.fog = new T.FogExp2(HOME_HAZE_COLOR, HOME_HAZE_DENSITY);

    const environment = makeHomeEnvironment(renderer);
    // The sun carries the scene. Sky light stays far weaker, as under thin
    // air: cool from above, warmed from below by the sunlit ground. No
    // camera-side fill flattens the shade the sun leaves.
    scene.add(new T.HemisphereLight(0x86abec, 0xc98552, 1.3));
    const sun = new T.DirectionalLight(HOME_SUN_COLOR, 5.2);
    sun.target.position.set(-5, 0, -21);
    sun.position
        .copy(sun.target.position)
        .addScaledVector(HOME_SUN_DIRECTION, 130);
    sun.castShadow = true;
    // The map is drawn once. A low sun sees the ground edge-on, so the
    // frustum is wide but only as tall as the outpost and its long shadows.
    const shadowSize = coarse ? 2048 : 4096;
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    Object.assign(sun.shadow.camera, {
        left: -42,
        right: 42,
        top: 16,
        bottom: -9,
        near: 60,
        far: 200,
    });
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.04;
    sun.shadow.radius = 2.4;
    scene.add(sun, sun.target);

    // Underfoot, the ground is slabs, sand and stones too small to measure
    // from orbit. Until that detail arrives it is level and of one tone.
    let floor = plainHomeFloor();
    const floorUniforms = {
        floorRelief: { value: floor.relief },
        floorColour: { value: floor.colour },
    };
    const groundMaterial = new T.MeshStandardMaterial({
        color: 0xa9937c,
        roughness: 0.98,
        bumpScale: 0.14,
    });
    // Fixed world-space texture scales avoid swimming while exploring. Fine
    // grain fades into broad mineral variation instead of a repeating horizon.
    for (const map of [terrain.fineTone, terrain.broadTone, terrain.normals])
        map.anisotropy = anisotropy;
    groundMaterial.onBeforeCompile = (shader) => {
        applyHomeHaze(shader);
        Object.assign(shader.uniforms, floorUniforms);
        shader.uniforms.siteFrame = { value: terrain.frame };
        shader.uniforms.fineTone = { value: terrain.fineTone };
        shader.uniforms.broadTone = { value: terrain.broadTone };
        shader.uniforms.siteNormals = { value: terrain.normals };
        shader.vertexShader = shader.vertexShader
            .replace(
                "#include <common>",
                `#include <common>
                attribute vec2 terrainShape;
                varying float terrainDistance; varying vec3 terrainPlace; varying vec2 terrainCourse;`,
            )
            .replace(
                "#include <worldpos_vertex>",
                `#include <worldpos_vertex>
                vec3 terrainWorld=(modelMatrix*vec4(transformed,1.)).xyz;
                terrainDistance=length(cameraPosition-terrainWorld);
                terrainPlace=terrainWorld;
                terrainCourse=terrainShape;
                vec2 terrainXZ=terrainWorld.xz;
                // The grain is laid out in metres of ground, not in fractions
                // of whichever mesh happens to carry it.
                #ifdef USE_MAP
                    vMapUv=terrainXZ*vec2(.2556,-.2556);
                #endif
                #ifdef USE_BUMPMAP
                    vBumpMapUv=terrainXZ*vec2(.2556,-.2556);
                #endif`,
            );
        shader.fragmentShader = shader.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
                varying float terrainDistance; varying vec3 terrainPlace; varying vec2 terrainCourse;
                uniform vec4 siteFrame; uniform sampler2D fineTone,broadTone,siteNormals,floorRelief,floorColour;
                ${HOME_BEDS_GLSL}`,
            )
            .replace(
                "#include <map_fragment>",
                `
                vec2 terrainXZ=terrainPlace.xz;
                // This fragment's place on the measured ground: metres east
                // and north of the data's centre.
                vec2 site=vec2(
                    siteFrame.z+terrainXZ.x*siteFrame.x-terrainXZ.y*siteFrame.y,
                    siteFrame.w-terrainXZ.x*siteFrame.y-terrainXZ.y*siteFrame.x);
                float fineGround=1.-smoothstep(.86,.98,max(abs(site.x),abs(site.y))/${HOME_TERRAIN_FINE}.);
                // Tone the orbital camera saw, with its own lighting removed.
                float seen=.5+texture2D(broadTone,site/${HOME_TERRAIN_BROAD * 2}.+.5).r;
                seen*=mix(1.,.5+texture2D(fineTone,site/${HOME_TERRAIN_FINE * 2}.+.5).r,fineGround);
                diffuseColor.rgb*=mix(1.,seen,1.2);
                // Metre-scale relief as measured, turned to face the scene.
                vec3 relief=texture2D(siteNormals,site/${HOME_TERRAIN_FINE * 2}.+.5).xyz*2.-1.;
                relief=vec3(relief.x*siteFrame.x+relief.z*siteFrame.y,relief.y,relief.z*siteFrame.x-relief.x*siteFrame.y);
                relief=normalize(mix(inverseTransformDirection(normalize(vNormal),viewMatrix),relief,fineGround));
                // Where beds were cut into the butte, the slope the orbiter
                // measured is shared out again: nearly level along a tread,
                // banked where rubble lies, steep up a face.
                float bedAlong=fract(terrainCourse.x);
                float bedPart=homeBedPart(bedAlong);
                relief.xz*=mix(1.,homeBedSlope(bedAlong),terrainCourse.y);
                relief=normalize(relief);
                #ifdef USE_MAP
                    // A face shows the rock itself: courses of differing
                    // tone, finely laminated, stained where water once ran
                    // down them. Rubble is the same rock, broken and shaded
                    // by its own pieces.
                    float courseTone=.8+.45*fract(sin(floor(terrainCourse.x)*12.9898)*43758.5453);
                    float laminae=terrainCourse.x*9.;
                    float lamina=(.5+.5*sin(laminae*6.2832))*(1.-smoothstep(.15,.5,fwidth(laminae)));
                    float stain=texture2D(map,vec2(dot(terrainXZ,vec2(.06,.035)),terrainCourse.x*.3)).r;
                    float broken=texture2D(map,terrainXZ*.9).r;
                    vec3 rock=diffuseColor.rgb*vec3(1.3,1.17,1.02)*courseTone*(.8+.3*lamina)*(.6+.75*stain);
                    vec3 scree=diffuseColor.rgb*(.52+.6*broken)*mix(1.,courseTone,.5);
                    diffuseColor.rgb=mix(diffuseColor.rgb,bedPart>1.5?rock:scree,step(.5,bedPart)*terrainCourse.y);
                #endif
                // Level ground is the floor underfoot: slabs, sand and stones.
                // Two copies of its one square, out of step with each
                // other, trade places in patches, so no repeat shows.
                float floorLevel=(1.-step(.5,bedPart)*terrainCourse.y)*smoothstep(.72,.9,relief.y);
                vec2 floorAt=terrainXZ/${HOME_FLOOR.metres.toFixed(1)};
                vec2 floorElse=floorAt+vec2(.37,.61);
                #ifdef USE_MAP
                    float floorPatch=smoothstep(.44,.56,texture2D(map,terrainXZ*.011+.3).r);
                #else
                    float floorPatch=0.;
                #endif
                vec4 floorShape=mix(texture2D(floorRelief,floorAt),texture2D(floorRelief,floorElse),floorPatch);
                vec3 floorTone=mix(texture2D(floorColour,floorAt).rgb,texture2D(floorColour,floorElse).rgb,floorPatch);
                // Its own stones and slab edges shade it under this sun.
                float floorSunlit=mix(1.,floorShape.b,floorLevel);
                #ifdef USE_MAP
                    // Every scale is always sampled: a lookup inside a
                    // branch has no defined screen derivative, and real
                    // GPUs return garbage at the branch's edge.
                    float distant=smoothstep(28.,110.,terrainDistance);
                    floorTone*=.84+.3*texture2D(map,terrainXZ*2.1).g;
                    diffuseColor.rgb*=mix(mix(texture2D(map,vMapUv).rgb,floorTone,floorLevel),texture2D(map,vMapUv*.08).rgb,distant);
                #else
                    diffuseColor.rgb*=floorTone;
                #endif
                // Six wheels have left two ruts from the settlement to where
                // the rover stands: fines pressed flat and darker, a lip
                // thrown up either side, and the bar of every grouser. The
                // way is a straight, a bend and a straight; nothing here
                // branches, because a derivative is taken further down.
                vec2 rutFrom=terrainXZ-vec2(${metres(TRACK.x - TRACK.radius)},${metres(TRACK.bend)});
                vec2 rutPast=terrainXZ-vec2(${metres(TRACK_END.x)},${metres(TRACK_END.z)});
                vec2 rutLast=vec2(${metres(TRACK_END.outX)},${metres(TRACK_END.outZ)});
                float rutOnward=dot(rutPast,vec2(rutLast.y,-rutLast.x));
                float inBend=step(terrainXZ.y,${metres(TRACK.bend)});
                float inLast=inBend*step(0.,rutOnward);
                float rutRadius=max(length(rutFrom),.001);
                vec2 rutOut=mix(vec2(1.,0.),mix(rutFrom/rutRadius,rutLast,inLast),inBend);
                float rutMiddle=mix(terrainXZ.x-${metres(TRACK.x)},mix(rutRadius-${metres(TRACK.radius)},dot(rutPast,rutLast),inLast),inBend);
                float rutRoute=mix(${metres(TRACK.front)}-terrainXZ.y,${metres(TRACK_END.first)}+mix(${metres(TRACK.radius)}*atan(max(-rutFrom.y,0.),max(rutFrom.x,.001)),${metres(TRACK.radius * TRACK.turn)}+rutOnward,inLast),inBend);
                float rutOff=abs(rutMiddle)-${metres(TRACK.gauge / 2)};
                float rutAcross=abs(rutOff);
                float rutSide=sign(rutOff)*sign(rutMiddle);
                float driven=smoothstep(0.,.3,rutRoute)*(1.-smoothstep(${metres(TRACK.fades[0])},${metres(TRACK.fades[1])},rutRoute))*floorLevel;
                float rutEdge=clamp((rutAcross-.185)/.06,0.,1.);
                float pressed=(1.-rutEdge*rutEdge*(3.-2.*rutEdge))*driven;
                float rutOver=(rutAcross-.27)/.035;
                float rutLip=exp(-rutOver*rutOver)*driven;
                float rutSharp=1.-smoothstep(.35,.9,fwidth(rutAcross)/.06);
                float barPhase=(rutRoute+rutAcross*.35)/.115;
                float barSharp=1.-smoothstep(.2,.55,fwidth(barPhase));
                float barWave=.5+.5*cos(barPhase*6.2832);
                float barStep=clamp((barWave-.5)/.4,0.,1.);
                float bar=barStep*barStep*(3.-2.*barStep);
                float barAhead=smoothstep(.5,.9,.5+.5*cos((barPhase+.14)*6.2832));
                // Slopes of that shape: across the rut, then along it.
                float rutAcrossSlope=(.018*6.*rutEdge*(1.-rutEdge)/.06*driven-.008*rutLip*2.*rutOver/.035)*rutSharp;
                float rutAlongSlope=.0055*pressed*barSharp*6.*barStep*(1.-barStep)/.4*(-3.1416*sin(barPhase*6.2832))/.115;
                vec2 rutSlope=rutAcrossSlope*rutSide*rutOut+rutAlongSlope*vec2(rutOut.y,-rutOut.x);
                // Each bar shades the hollow behind it from so low a sun.
                floorSunlit=mix(floorSunlit,1.,.7*pressed)*(1.-.6*pressed*barSharp*clamp((barAhead-bar)*1.6,0.,1.));
                diffuseColor.rgb*=1.-pressed*(.28-.08*bar*barSharp)+.09*rutLip;`,
            )
            .replace(
                "#include <normal_fragment_maps>",
                `
                float terrainDetail=1.-smoothstep(18.,100.,terrainDistance);
                normal=normalize((viewMatrix*vec4(relief,0.)).xyz);
                vec3 terrainNormal=normal;
                #include <normal_fragment_maps>
                // Relief is derived from screen derivatives, so it is
                // evaluated everywhere and only its weight fades out.
                normal=normalize(mix(terrainNormal,normal,terrainDetail));
                vec2 floorSlope=(floorShape.rg-.5)*${(HOME_FLOOR.steepest * 2).toFixed(1)}*(1.-.8*pressed)+rutSlope;
                vec3 floorNormal=normalize(relief-vec3(floorSlope.x,0.,floorSlope.y));
                normal=normalize(mix(normal,(viewMatrix*vec4(floorNormal,0.)).xyz,floorLevel));`,
            )
            .replace(
                "reflectedLight.directDiffuse *= homeLit;",
                "reflectedLight.directDiffuse *= homeLit * floorSunlit;",
            )
            .replace(
                "reflectedLight.directSpecular *= homeLit;",
                "reflectedLight.directSpecular *= homeLit * floorSunlit;",
            );
    };
    groundMaterial.customProgramCacheKey = () => "explorable-regolith-v10";
    const axis = (bands: number[][]) => {
        const values = [bands[0][0]];
        for (const [from, to, step] of bands) {
            const count = Math.ceil((to - from) / step);
            for (let i = 1; i <= count; i++)
                values.push(T.MathUtils.lerp(from, to, i / count));
        }
        return values;
    };
    /** Slopes come from the height itself, so separate meshes agree at a seam. */
    const shade = (
        geometry: T.BufferGeometry,
        span: number,
        height: (x: number, z: number) => number,
    ) => {
        const points = geometry.attributes.position,
            normals = geometry.attributes.normal,
            normal = new T.Vector3();
        for (let i = 0; i < points.count; i++) {
            const x = points.getX(i),
                z = points.getZ(i);
            normal
                .set(
                    height(x - span, z) - height(x + span, z),
                    span * 2,
                    height(x, z - span) - height(x, z + span),
                )
                .normalize();
            normals.setXYZ(i, normal.x, normal.y, normal.z);
        }
        return geometry;
    };
    const dusted = (geometry: T.BufferGeometry, coursed = false) => {
        const points = geometry.attributes.position;
        const colors = new Float32Array(points.count * 3);
        for (let i = 0; i < points.count; i++)
            colors.fill(
                0.72 +
                    noise.noise(
                        points.getX(i) * 0.14,
                        points.getZ(i) * 0.14,
                        6,
                    ) *
                        0.22,
                i * 3,
                i * 3 + 3,
            );
        geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
        // Which course of the butte a vertex stands on, and how strongly
        // it shows; nothing, away from the butte.
        const shape = new Float32Array(points.count * 2);
        if (coursed)
            for (let i = 0; i < points.count; i++) {
                const { bed, strength } = beds.at(
                    points.getX(i),
                    points.getZ(i),
                );
                shape.set([bed, strength], i * 2);
            }
        geometry.setAttribute("terrainShape", new T.BufferAttribute(shape, 2));
        return geometry;
    };
    groundMaterial.vertexColors = true;
    // One grid of lines resolves the rover and settlement finely and thins
    // toward half a kilometre. Its fine heart and its surround are separate
    // meshes that share every vertex along their seam.
    const xs = axis([
            [-420, -200, 10],
            [-200, -90, 5],
            [-90, -50, 4],
            [-50, -24, 2],
            [-24, 24, 0.75],
            [24, 50, 2],
            [50, 90, 4],
            [90, 200, 5],
            [200, 420, 10],
        ]),
        zs = axis([
            [-620, -300, 12],
            [-300, -140, 6],
            [-140, -100, 4],
            [-100, -60, 2],
            [-60, -45, 1.5],
            [-45, 15, 0.75],
            [15, 40, 2],
            [40, 100, 5],
            [100, 300, 12],
        ]);
    const heart = (left: number, right: number, back: number, front: number) =>
        left >= -90 && right <= 90 && back >= -140 && front <= 40;
    const ground = tileTerrain(
        dusted(
            shade(
                makeTerrainGrid(xs, zs, heightAt, (...cell) => !heart(...cell)),
                0.5,
                heightAt,
            ),
        ),
        groundMaterial,
        60,
        true,
    );
    // Low light makes every rise shade the ground behind it.
    ground.children.forEach((tile) => {
        tile.castShadow = true;
    });
    scene.add(ground);
    // The butte has ground of its own, fine enough to hold its ledges. The
    // grid around it ducks beneath, as the far rings duck beneath that grid.
    const beneath = (x: number, z: number) =>
        x > beds.left + 14 &&
        x < beds.right - 14 &&
        z > beds.back + 14 &&
        z < beds.front - 14;
    scene.add(
        tileTerrain(
            dusted(
                shade(
                    makeTerrainGrid(
                        xs,
                        zs,
                        (x, z) => heightAt(x, z) - (beneath(x, z) ? 7 : 0),
                        (left, right, back, front) =>
                            heart(left, right, back, front) ||
                            (beneath(left, back) && beneath(right, front)),
                    ),
                    2,
                    heightAt,
                ),
            ),
            groundMaterial,
            { x: 280, z: 230 },
            true,
        ),
    );
    const ledgeStep = coarse ? 4 : 2;
    scene.add(
        tileTerrain(
            dusted(
                // Normals stay those of the measured slope; the shader
                // turns them by the course each fragment stands on.
                shade(
                    makeTerrainGrid(
                        axis([[beds.left, beds.right, ledgeStep]]),
                        axis([[beds.back, beds.front, ledgeStep]]),
                        carvedAt,
                    ),
                    1,
                    heightAt,
                ),
                true,
            ),
            groundMaterial,
            130,
        ),
    );
    // Beyond that the crater floor runs on in two coarser rings, to the
    // delta front and the rim. Each ring ducks under the finer ground it
    // surrounds, so the overlap can never show through.
    for (const [reach, step, left, right, back, front, duck] of [
        [4096, 64, -420, 420, -620, 300, 2.5],
        [8192, 256, -4096, 4096, -4096, 4096, 8],
    ]) {
        const lines = axis([[-reach, reach, step]]);
        const under = (x: number, z: number) =>
            x > left && x < right && z > back && z < front;
        const height = (x: number, z: number) =>
            terrain.heightAt(x, z) - (under(x, z) ? duck : 0);
        const geometry = makeTerrainGrid(
            lines,
            lines,
            height,
            (l, r, b, f) => under(l, b) && under(r, f),
        );
        const ring = new T.Mesh(
            dusted(shade(geometry, step / 2, terrain.heightAt)),
            groundMaterial,
        );
        ring.matrixAutoUpdate = false;
        ring.receiveShadow = false;
        scene.add(ring);
    }

    // Stones here are broken, not rounded: a lump cut by a few planes, each
    // break keeping a hard edge and a face that is rough rather than flat,
    // with dust settled on whatever faces up and none underneath.
    const rockMaterial = new T.MeshStandardMaterial({
        color: 0xb8a28a,
        roughness: 0.95,
        vertexColors: true,
    });
    rockMaterial.onBeforeCompile = applyHomeHaze;
    const cut = new T.Vector3(),
        corner = new T.Vector3();
    const broken: T.BufferGeometry[] = [];
    // No stone lies in the rover's ruts or on the staked cable way.
    const cableWay = new T.CatmullRomCurve3(
        HOME_CABLE_WAY.map(([x, z]) => new T.Vector3(x, 0, z)),
    ).getPoints(60);
    for (let variant = 0; variant < 4; variant++) {
        const rockGeometry = (detail: number) => {
            const source = new T.IcosahedronGeometry(1, detail);
            source.deleteAttribute("normal");
            const merged = mergeVertices(source);
            source.dispose();
            const points = merged.attributes.position;
            for (let plane = 0; plane < 7; plane++) {
                cut.set(
                    random() * 2 - 1,
                    random() * 1.4 - 0.5,
                    random() * 2 - 1,
                ).normalize();
                const reach = 0.5 + random() * 0.35;
                for (let i = 0; i < points.count; i++) {
                    corner.fromBufferAttribute(points, i);
                    const beyond = corner.dot(cut) - reach;
                    if (beyond > 0)
                        points.setXYZ(
                            i,
                            corner.x - cut.x * beyond,
                            corner.y - cut.y * beyond,
                            corner.z - cut.z * beyond,
                        );
                }
            }
            const colors = new Float32Array(points.count * 3);
            // A finer lump can carry finer roughness without folding.
            const grain = detail > 1 ? 1 : 0;
            for (let i = 0; i < points.count; i++) {
                corner.fromBufferAttribute(points, i);
                const pitted = noise.noise(
                    corner.x * 6.5 + variant * 3,
                    corner.y * 6.5,
                    corner.z * 6.5,
                );
                const lump =
                    0.9 +
                    noise.noise(
                        corner.x * 2.5,
                        corner.y * 2.5,
                        corner.z * 2.5 + variant * 7,
                    ) *
                        0.16 +
                    grain *
                        (pitted * 0.045 +
                            noise.noise(
                                corner.x * 15,
                                corner.y * 15 + variant * 5,
                                corner.z * 15,
                            ) *
                                0.014);
                points.setXYZ(
                    i,
                    corner.x * lump,
                    corner.y * lump * 0.72,
                    corner.z * lump,
                );
                // Dust lies on what faces up; hollows and the foot stay dark.
                const up = T.MathUtils.smoothstep(corner.y, -0.25, 0.6),
                    hollow = 1 + grain * Math.min(0, pitted) * 0.5,
                    foot =
                        0.72 +
                        0.28 * T.MathUtils.smoothstep(corner.y, -0.5, -0.05);
                colors.set(
                    [
                        (0.8 + up * 0.2) * hollow * foot,
                        (0.78 + up * 0.22) * hollow * foot,
                        (0.76 + up * 0.24) * hollow * foot,
                    ],
                    i * 3,
                );
            }
            merged.setAttribute("color", new T.BufferAttribute(colors, 3));
            // Faces that meet at more than a shallow angle keep their edge.
            const geometry = toCreasedNormals(merged, Math.PI / 5.5);
            merged.dispose();
            return geometry;
        };
        // A pebble, and a block on the butte seen from afar, need far fewer
        // faces than a boulder a few metres from the camera.
        const pebbles = new T.InstancedMesh(rockGeometry(1), rockMaterial, 80);
        // A few stones are set by hand where the composed view wants its
        // foreground to have depth: place, size and turn.
        const set = SET_STONES.filter((_stone, index) => index % 4 === variant);
        const rocks = new T.InstancedMesh(
            rockGeometry(coarse ? 2 : 3),
            rockMaterial,
            30 + set.length,
        );
        const pose = new T.Object3D();
        for (let i = 0; i < 110; i++) {
            let x = random() * 68 - 30,
                z = random() * 60 - 44;
            if (Math.hypot(x - 2, z) < 3.6) {
                x += 5;
                z -= 3;
            }
            // Most stones are small; a boulder is the exception. None lie
            // on the graded pad, in the greenhouses or on the drone's pad.
            const driven = trackAt(x, z);
            const cleared =
                Math.hypot((x + 10) / 1.25, z + 31) < 14 ||
                (x > -9 && x < 14 && z > -31 && z < -19) ||
                HOME_YARD_GROUND.some(
                    (yard) => Math.hypot(x - yard.x, z - yard.z) < yard.level,
                ) ||
                (driven.along > -0.5 &&
                    driven.along < TRACK.fades[1] &&
                    Math.abs(driven.across) < TRACK.gauge / 2 + 0.6) ||
                cableWay.some(
                    (stake) => Math.hypot(x - stake.x, z - stake.z) < 1.3,
                );
            // Drawn whether or not the stone is kept, so that clearing one
            // place never moves the stones of another.
            const drawn =
                i < 80
                    ? 0.04 + random() * 0.13
                    : 0.16 + Math.pow(random(), 2.4) * 0.6;
            const size = cleared ? 0 : drawn;
            pose.position.set(x, heightAt(x, z) + size * 0.2, z);
            pose.scale.set(
                size * (0.8 + random() * 0.9),
                size * (0.75 + random() * 0.5),
                size * (0.8 + random() * 0.6),
            );
            pose.rotation.set(
                random() * 0.3,
                random() * Math.PI * 2,
                random() * 0.2,
            );
            pose.updateMatrix();
            if (i < 80) pebbles.setMatrixAt(i, pose.matrix);
            else rocks.setMatrixAt(i - 80, pose.matrix);
        }
        set.forEach(([x, z, size, turn], index) => {
            pose.position.set(x, heightAt(x, z) + size * 0.2, z);
            pose.scale.set(size * 1.3, size, size * 1.05);
            pose.rotation.set(0.1, turn, 0.06);
            pose.updateMatrix();
            rocks.setMatrixAt(30 + index, pose.matrix);
        });
        for (const instances of [pebbles, rocks]) {
            instances.castShadow = true;
            instances.receiveShadow = true;
            instances.userData.contactOcclusion = true;
            scene.add(instances);
        }
        broken.push(pebbles.geometry);
    }
    // Blocks broken from each ledge of the butte lie on the tread below it,
    // thickest at the foot of the face they fell from.
    const fallenPose = new T.Object3D();
    for (const geometry of broken) {
        const talus = new T.InstancedMesh(geometry, rockMaterial, 130);
        let fallen = 0;
        for (let attempt = 0; attempt < 8000 && fallen < 130; attempt++) {
            const x = T.MathUtils.lerp(beds.left, beds.right, random()),
                z = T.MathUtils.lerp(beds.back, beds.front, random());
            const place = beds.at(x, z);
            const along = place.bed - Math.floor(place.bed);
            if (
                place.strength < 0.25 ||
                along > HOME_BEDS.rubble.ends ||
                random() >
                    Math.pow(Math.min(1, along / HOME_BEDS.tread.ends), 3) *
                        place.strength
            )
                continue;
            const size = 0.45 + Math.pow(random(), 3) * 2.6;
            fallenPose.position.set(
                x,
                heightAt(x, z) + place.cut + size * 0.2,
                z,
            );
            fallenPose.scale.set(
                size * (0.8 + random() * 0.9),
                size * (0.75 + random() * 0.5),
                size * (0.8 + random() * 0.6),
            );
            fallenPose.rotation.set(
                random() * 0.3,
                random() * Math.PI * 2,
                random() * 0.2,
            );
            fallenPose.updateMatrix();
            talus.setMatrixAt(fallen++, fallenPose.matrix);
        }
        talus.count = fallen;
        scene.add(talus);
    }

    // High, thin ice cloud as one tileable field: five scales of smooth
    // noise, each wrapping at the edge of the image.
    const VEIL = 256;
    const veilField = new Float32Array(VEIL * VEIL);
    for (let cells = 4, weight = 0.5; cells <= 64; cells *= 2, weight /= 2) {
        const lattice = Float32Array.from({ length: cells * cells }, random);
        const ease = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
        for (let y = 0; y < VEIL; y++)
            for (let x = 0; x < VEIL; x++) {
                const u = (x / VEIL) * cells,
                    v = (y / VEIL) * cells,
                    i = Math.floor(u),
                    j = Math.floor(v),
                    fu = ease(u - i),
                    fv = ease(v - j);
                const at = (column: number, row: number) =>
                    lattice[(row % cells) * cells + (column % cells)];
                veilField[y * VEIL + x] +=
                    weight *
                    T.MathUtils.lerp(
                        T.MathUtils.lerp(at(i, j), at(i + 1, j), fu),
                        T.MathUtils.lerp(at(i, j + 1), at(i + 1, j + 1), fu),
                        fv,
                    );
            }
    }
    const veil = new T.DataTexture(
        Uint8Array.from(veilField, (value) => Math.round(value * 255)),
        VEIL,
        VEIL,
        T.RedFormat,
    );
    veil.wrapS = veil.wrapT = T.RepeatWrapping;
    veil.magFilter = T.LinearFilter;
    veil.minFilter = T.LinearMipmapLinearFilter;
    veil.generateMipmaps = true;
    veil.needsUpdate = true;
    textures.add(veil);

    // The sky a visitor would want over Mars before the day takes hold:
    // dawn along one horizon, and the night still standing over the other,
    // with the galaxy's core, thin cloud lit from beneath, and home as the
    // morning star with its moon beside it.
    const galaxyCentre = new T.Vector3(-0.72, 0.52, -0.46).normalize(),
        galaxyRight = new T.Vector3(0, 1, 0).cross(galaxyCentre).normalize(),
        galaxyUp = galaxyCentre.clone().cross(galaxyRight);
    const earth = new T.Vector3(-0.3956, 0.1253, -0.9098).normalize();
    const skyMaterial = new T.ShaderMaterial({
        side: T.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
            galaxy: { value: null as T.Texture | null },
            cirrus: { value: veil },
            skyline: { value: terrain.skyline },
            // The compass bearing the scene's -Z axis looks along, in turns.
            heading: { value: HOME_SITE.heading / 360 },
            sunDirection: { value: HOME_SUN_DIRECTION },
            galaxyCentre: { value: galaxyCentre },
            galaxyRight: { value: galaxyRight },
            galaxyUp: { value: galaxyUp },
            earth: { value: earth },
            // The moon stands a seventh of a degree from the planet.
            moon: {
                value: earth
                    .clone()
                    .add(new T.Vector3(0.0021, 0.0013, 0))
                    .normalize(),
            },
            drift: { value: 0 },
        },
        vertexShader: `varying vec3 vDirection; void main() {vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `uniform sampler2D galaxy,cirrus,skyline; uniform vec3 sunDirection,galaxyCentre,galaxyRight,galaxyUp,earth,moon; uniform float drift,heading; varying vec3 vDirection;
            ${HOME_SKY_GLSL}
            // One star at most in each cell of a grid laid through the
            // sphere of directions; never smaller than a pixel.
            vec3 homeStars(vec3 d){
                vec3 p=d*210.;
                vec3 cell=floor(p);
                vec3 chance=fract(sin(vec3(dot(cell,vec3(127.1,311.7,74.7)),dot(cell,vec3(269.5,183.3,246.1)),dot(cell,vec3(113.5,271.9,124.6))))*43758.5453);
                float width=max(.055,length(fwidth(p))*.8);
                float away=length(p-cell-.2-.6*chance.yzx);
                // Few are bright; most are only just there.
                float magnitude=pow(chance.x,44.)+.07*pow(chance.x,18.);
                vec3 tint=mix(vec3(1.,.84,.7),vec3(.72,.84,1.),chance.z);
                return tint*magnitude*exp(-away*away/(width*width))*min(1.,.003/(width*width))*16.;
            }
            float point(vec3 d,vec3 at){
                float width=max(.0006,length(fwidth(d))*.8);
                float away=length(d-at);
                return exp(-away*away/(width*width));
            }
            // Land too far off to be built as ground: the crater's rim
            // and the highlands past it, standing as high as they were
            // measured to from here. Slopes that face the sun are lit and
            // the rest stand in shade; dust hides their feet as it does
            // everything's, and never quite the crests above it.
            vec3 homeRim(vec3 sky,vec3 d,float turn,float rise,float top,float km,float lit,float range){
                float edge=max(fwidth(rise)*.75,.003);
                float cover=smoothstep(-edge,edge,top-rise)*step(.02,km);
                // Spurs and the gullies between them run down from the
                // crest; the upper slopes stand clear of the floor's dust.
                float crest=clamp(rise/max(top,.4),0.,1.);
                float spurs=texture2D(cirrus,vec2(turn*26.,crest*.16+range)).r;
                float gullies=texture2D(cirrus,vec2(turn*150.,crest*.45+range*1.7)).r;
                float sunned=lit*smoothstep(.3,.62,spurs*.75+gullies*.25);
                vec3 land=mix(vec3(.036,.032,.04),vec3(.3,.142,.058),sunned)*(.62+.5*crest)*(.82+.36*gullies);
                float climb=km*1000.*d.y/${HOME_HAZE_HEIGHT.toFixed(1)};
                float thin=abs(climb)>.001?(1.-exp(-climb))/climb:1.;
                float depth=${HOME_HAZE_DENSITY.toFixed(5)}*km*1000.*thin*exp(-max(cameraPosition.y,0.)/${HOME_HAZE_HEIGHT.toFixed(1)});
                float haze=min(1.-exp(-depth*depth),.5+.004*km);
                return mix(sky,mix(land,homeHaze(d,sunDirection),min(haze,.86)),cover);
            }
            void main(){
                vec3 d=normalize(vDirection);
                vec3 sky=homeSky(d,sunDirection);
                // A true disc for anyone who turns to face it; the composed
                // views keep it just outside the frame.
                float limb=length(cross(d,sunDirection));
                sky+=vec3(1.,.78,.52)*40.*step(0.,dot(d,sunDirection))*(1.-smoothstep(.0045,.0058,limb));
                // Night shows wherever the dawn has not reached.
                float dark=(1.-smoothstep(.03,.2,dot(sky,vec3(.3,.5,.2))))*smoothstep(0.,.1,d.y);
                float facing=dot(d,galaxyCentre);
                vec2 across=vec2(dot(d,galaxyRight),dot(d,galaxyUp))/max(facing,.25)/vec2(2.9,1.81)+.5;
                vec2 held=smoothstep(vec2(0.),vec2(.16),across)*smoothstep(vec2(1.),vec2(.84),across);
                vec3 night=texture2D(galaxy,across).rgb*held.x*held.y*step(.25,facing)*.55;
                night+=homeStars(d);
                // Ice cloud far above the dust, on a level deck: long
                // streaks down the wind, broken by a finer scale.
                vec2 over=d.xz/(max(d.y,0.)+.07);
                vec2 deck=vec2(dot(over,vec2(.82,.57)),dot(over,vec2(-.57,.82)));
                float streak=texture2D(cirrus,deck*vec2(.026,.15)+vec2(drift,0.)).r;
                float billow=texture2D(cirrus,deck*vec2(.11,.31)+vec2(.37+drift*1.7,.11)).r;
                float cloud=smoothstep(.56,.8,streak*.74+billow*.42)*smoothstep(.012,.06,d.y)*(1.-smoothstep(.3,.75,d.y));
                vec2 flatSun=normalize(sunDirection.xz), flatView=normalize(d.xz+vec2(1e-5));
                float toward=pow(clamp(dot(flatView,flatSun)*.5+.5,0.,1.),3.);
                sky+=night*dark*(1.-.7*cloud);
                sky+=mix(vec3(.045,.05,.075),vec3(1.2,.6,.34),toward)*cloud*.42;
                sky+=vec3(.5,.72,1.)*9.*point(d,earth)+vec3(.8,.8,.78)*2.2*point(d,moon);
                float turn=atan(d.x,-d.z)/6.2831853+heading;
                vec4 rim=texture2D(skyline,vec2(turn,.5));
                float rise=degrees(asin(clamp(d.y,-1.,1.)));
                float lit=smoothstep(.2,.8,.5-.5*dot(flatView,flatSun));
                sky=homeRim(sky,d,turn,rise,rim.g,rim.a,lit,.61);
                sky=homeRim(sky,d,turn,rise,rim.r,rim.b,lit,.23);
                gl_FragColor=vec4(sky,1.);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }`,
    });
    const sky = new T.Mesh(new T.SphereGeometry(16000, 32, 24), skyMaterial);
    // Opaque terrain writes depth first, rejecting covered sky fragments before
    // their galaxy texture and atmospheric shader need to run.
    sky.renderOrder = 1000;
    scene.add(sky);

    /** The ground wherever something stands on it, near or far. */
    const surfaceAt = heightAt;
    const draco = new DRACOLoader();
    draco.setDecoderPath("/draco/");
    draco.setDecoderConfig({ type: "js" });
    draco.setWorkerLimit(1);
    const models = new GLTFLoader().setDRACOLoader(draco);
    const frontier = makeHomeFrontier(
        heightAt,
        environment.texture,
        surfaceAt,
        (url) => models.loadAsync(url).then((gltf) => gltf.scene),
        coarse,
        anisotropy,
    );
    scene.add(frontier.root);
    const loader = new T.TextureLoader();
    const disposeObject = (root: T.Object3D) => {
        const geometries = new Set<T.BufferGeometry>();
        const materials = new Set<T.Material>();
        root.traverse((obj) => {
            if (!(obj instanceof T.Mesh)) return;
            if (obj instanceof T.InstancedMesh) obj.dispose();
            geometries.add(obj.geometry);
            (Array.isArray(obj.material)
                ? obj.material
                : [obj.material]
            ).forEach((material) => {
                materials.add(material);
                Object.values(material).forEach((value) => {
                    if (value instanceof T.Texture) textures.add(value);
                });
            });
        });
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((material) => material.dispose());
    };
    const disposeTextures = () => {
        const bitmaps = new Set<ImageBitmap>();
        textures.forEach((texture) => {
            const data = texture.source.data;
            if (
                typeof ImageBitmap !== "undefined" &&
                data instanceof ImageBitmap
            )
                bitmaps.add(data);
            texture.dispose();
        });
        bitmaps.forEach((bitmap) => bitmap.close());
        textures.clear();
    };
    const texture = async (path: string, color = false) => {
        const result = await loader.loadAsync(path);
        if (disposed) {
            result.dispose();
            return result;
        }
        if (color) result.colorSpace = T.SRGBColorSpace;
        result.anisotropy = anisotropy;
        textures.add(result);
        return result;
    };
    // The page backdrop has already requested one of these files (1k on
    // narrow screens, 2k otherwise); only a canvas wider than that image
    // can resolve the larger one.
    const skyDetail = matchMedia("(max-width: 800px)").matches
        ? "1k"
        : Math.max(innerWidth, innerHeight) *
                Math.min(devicePixelRatio || 1, 1.5) >
            2400
          ? "4k"
          : "2k";
    const ready = Promise.all([
        frontier.ready,
        loadHomeFloor(!coarse, anisotropy).then((loaded) => {
            if (disposed) return loaded.dispose();
            floor.dispose();
            floor = loaded;
            floorUniforms.floorRelief.value = loaded.relief;
            floorUniforms.floorColour.value = loaded.colour;
        }),
        models
            .loadAsync("/models/home-rover-v1.glb")
            .then((gltf) => {
                if (disposed) {
                    disposeObject(gltf.scene);
                    disposeTextures();
                    return;
                }
                const finishes = new Map<T.Material, T.MeshStandardMaterial>();
                gltf.scene.traverse((obj) => {
                    if (obj instanceof T.Mesh) {
                        obj.castShadow = true;
                        obj.receiveShadow = true;
                        obj.userData.contactOcclusion = true;
                        const finish = (original: T.MeshStandardMaterial) => {
                            let material = finishes.get(original);
                            if (!material) {
                                // Small camera lenses need a reflected glint,
                                // not a second full-scene refraction pass.
                                material = new T.MeshStandardMaterial().copy(
                                    original,
                                );
                                material.envMap = environment.texture;
                                material.envMapIntensity = 1;
                                material.onBeforeCompile = applyHomeFinish;
                                // Decals and panel seams are read at a
                                // shallow angle from most camera positions.
                                for (const map of [
                                    material.map,
                                    material.normalMap,
                                    material.roughnessMap,
                                ])
                                    if (map) map.anisotropy = anisotropy;
                                if (original.name.includes("glass")) {
                                    material.color.setHex(0x23383d);
                                    material.metalness = 0.7;
                                    material.roughness = 0.2;
                                    material.transparent = false;
                                    material.opacity = 1;
                                }
                                // Mirror-smooth metal would sparkle under
                                // a single hard light.
                                material.roughness = Math.max(
                                    0.2,
                                    material.roughness,
                                );
                                finishes.set(original, material);
                            }
                            return material;
                        };
                        obj.material = Array.isArray(obj.material)
                            ? obj.material.map(finish)
                            : finish(obj.material);
                    }
                });
                finishes.forEach((_replacement, original) =>
                    original.dispose(),
                );
                scene.add(gltf.scene);
            })
            // The decoder is shared with the outpost's built hardware.
            .finally(() =>
                frontier.ready.catch(() => {}).finally(() => draco.dispose()),
            ),
        texture("/images/scenes/regolith-color-v1.webp", true).then((map) => {
            if (disposed) return;
            map.wrapS = map.wrapT = T.RepeatWrapping;
            groundMaterial.map = map;
            const rockColor = map.clone();
            rockColor.repeat.set(1, 1);
            textures.add(rockColor);
            rockMaterial.map = rockColor;
            rockMaterial.needsUpdate = true;
            groundMaterial.needsUpdate = true;
        }),
        texture("/images/scenes/regolith-height-v1.webp").then((map) => {
            if (disposed) return;
            map.wrapS = map.wrapT = T.RepeatWrapping;
            groundMaterial.bumpMap = map;
            groundMaterial.needsUpdate = true;
            const rockBump = map.clone();
            rockBump.repeat.set(1, 1);
            textures.add(rockBump);
            rockMaterial.bumpMap = rockBump;
            rockMaterial.bumpScale = 0.055;
            rockMaterial.needsUpdate = true;
        }),
        texture(`/images/trajectory/milky-way-v2-${skyDetail}.webp`, true).then(
            (map) => {
                if (!disposed) skyMaterial.uniforms.galaxy.value = map;
            },
        ),
    ]);
    const target = new T.Vector3();
    const views = {
        desktop: [
            {
                eye: new T.Vector3(9, 4.6, 16),
                aim: new T.Vector3(-4, 1.6, -8),
            },
            { eye: new T.Vector3(7, 8, 5), aim: new T.Vector3(-15, 3, -25) },
            { eye: new T.Vector3(3, 9, 1), aim: new T.Vector3(-16, 6.4, -27) },
        ],
        compact: [
            { eye: new T.Vector3(9, 5.8, 14), aim: new T.Vector3(0, 1.9, -9) },
            { eye: new T.Vector3(4, 8, 5), aim: new T.Vector3(-7, 2.4, -22) },
            { eye: new T.Vector3(2, 8, -3), aim: new T.Vector3(-8, 5.5, -24) },
        ],
    };
    const frame = (width: number, height: number, framing: HomeFraming) => {
        const view = homeCoverFrame(width, height, framing);
        // The wide composition keeps its left third for the page's words:
        // light falls away there, between these two points of the frame.
        rendering.shade(
            framing === "desktop",
            (0.14 * view.fullWidth - view.x) / view.width,
            (0.56 * view.fullWidth - view.x) / view.width,
        );
        camera.fov = framing !== "desktop" ? 36 : 33;
        camera.setViewOffset(
            view.fullWidth,
            view.fullHeight,
            view.x,
            view.y,
            view.width,
            view.height,
        );
    };
    const homePose = (framing: HomeFraming, focus: number) => {
        const stops = framing !== "desktop" ? views.compact : views.desktop;
        const from = Math.min(1, Math.floor(focus));
        const mix = focus - from;
        return {
            eye: new T.Vector3().lerpVectors(
                stops[from].eye,
                stops[from + 1].eye,
                mix,
            ),
            aim: new T.Vector3().lerpVectors(
                stops[from].aim,
                stops[from + 1].aim,
                mix,
            ),
        };
    };
    const explorationPose = (focus: number) =>
        [
            { eye: new T.Vector3(11, 5, 18), aim: new T.Vector3(2, 1.3, 0) },
            {
                eye: new T.Vector3(9, 10, -10),
                aim: new T.Vector3(-9, 2.6, -31),
            },
            { eye: new T.Vector3(2, 11, -19), aim: new T.Vector3(-10, 6, -33) },
        ][Math.round(focus)];
    const cameraFloor = (x: number, z: number) => {
        const station =
            1 -
            T.MathUtils.smoothstep(Math.hypot((x + 10) / 1.3, z + 31), 10, 20);
        const dish =
            1 - T.MathUtils.smoothstep(Math.hypot(x + 13, z + 33), 3, 7);
        // Nothing flies through a lander: fifty metres of it stand there.
        const landers = HOME_SHIP_SITES.reduce(
            (floor, site) =>
                Math.max(
                    floor,
                    (1 -
                        T.MathUtils.smoothstep(
                            Math.hypot(x - site.x, z - site.z),
                            12,
                            30,
                        )) *
                        (surfaceAt(site.x, site.z) + 56),
                ),
            -Infinity,
        );
        return Math.max(
            surfaceAt(x, z) + 1.2,
            station * 6.8,
            dish * 11.5,
            landers,
        );
    };
    const position = (
        width: number,
        height: number,
        framing: HomeFraming,
        x = 0,
        y = 0,
        focus = 0,
    ) => {
        const pose = homePose(framing, focus);
        camera.position.copy(pose.eye);
        camera.position.x += x * 0.52;
        camera.position.y += y * 0.25;
        target.copy(pose.aim);
        camera.lookAt(target);
        frame(width, height, framing);
    };
    const rendering = makeHomeRendering(renderer, scene, camera);
    return {
        scene,
        camera,
        ready,
        position,
        frame,
        homePose,
        explorationPose,
        cameraFloor,
        target,
        update(time: number) {
            frontier.update(time);
            // The cloud deck takes most of an hour to cross the sky.
            skyMaterial.uniforms.drift.value = time * 0.00003;
        },
        /** Opens the whole frame to light while the visitor explores it. */
        reveal: rendering.reveal,
        get occlusionUpdates() {
            return rendering.occlusionUpdates;
        },
        render: rendering.render,
        resize: rendering.resize,
        dispose() {
            if (disposed) return;
            disposed = true;
            frontier.release();
            rendering.dispose();
            disposeObject(scene);
            disposeTextures();
            environment.dispose();
            terrain.dispose();
            floor.dispose();
            shadow.dispose();
            sun.shadow.dispose();
            draco.dispose();
        },
    };
}
