import * as T from "three";

/**
 * One low sun drives the sky, the haze, surface shadows and metal reflections.
 * It sits three-quarters behind the composed views, just outside the frame:
 * forms turn from a warm lit edge into cool shade, and shadows rake toward
 * the lower left instead of hiding behind their objects.
 */
export const HOME_SUN_DIRECTION = new T.Vector3(0.286, 0.2, -0.958).normalize();

// Scene-referred linear colours shared by every consumer of the sky.
const ZENITH = [0.016, 0.031, 0.072];
const HORIZON_AWAY = [0.066, 0.064, 0.08];
const HORIZON_SUN = [0.66, 0.34, 0.16];
// Martian dust scatters blue light forward and absorbs it everywhere else,
// so the sun wears a cool halo inside the warm sky the same dust paints.
const HALO = [0.5, 0.66, 1];
const CORE = [0.85, 0.92, 1];
/** Direct sunlight after its long path through the dust. */
export const HOME_SUN_COLOR = new T.Color(1, 0.69, 0.42);
/** The haze colour a view straight across the frame fades into. */
export const HOME_HAZE_COLOR = new T.Color(0.27, 0.17, 0.11);
export const HOME_HAZE_DENSITY = 0.0006;
/** The height, in metres, over which the dust thins to a third. */
export const HOME_HAZE_HEIGHT = 60;

const vec3 = (value: number[]) =>
    `vec3(${value.map((part) => part.toFixed(4)).join(",")})`;

/**
 * GLSL for the same sky the reflection environment samples below.
 * `homeHaze` is the colour of the horizon in a direction, and so also the
 * colour distance fades to; `homeSky` adds height and the solar aureole.
 */
export const HOME_SKY_GLSL = `
    vec3 homeHaze(vec3 direction, vec3 sun) {
        vec2 flatSun = normalize(sun.xz);
        vec2 flatView = normalize(direction.xz + vec2(1e-5));
        float toward = pow(clamp(dot(flatView, flatSun) * .5 + .5, 0., 1.), 4.);
        return mix(${vec3(HORIZON_AWAY)}, ${vec3(HORIZON_SUN)}, toward);
    }
    vec3 homeSky(vec3 direction, vec3 sun) {
        float height = max(direction.y, 0.);
        float away = max(0., 1. - dot(direction, sun));
        // A bright band hugs the horizon under a long, thinning tail.
        float band = .7 * exp(-height * 15.) + .3 * exp(-height * 5.);
        vec3 sky = mix(${vec3(ZENITH)}, homeHaze(direction, sun), band);
        return sky + ${vec3(HALO)} * .42 * exp(-away * 9.) + ${vec3(CORE)} * 1.6 * exp(-away * 150.);
    }`;

/**
 * The low sun's shadow over the crater floor: for every place, the height
 * below which the ground upwind of the light shades it. A shadow map cannot
 * reach a butte half a kilometre away, and this sun never moves, so the
 * landscape works it out once and every surface reads it. Until it has, and
 * anywhere past its edge, everything stands in the open.
 *
 * Columns of the grid lean along the sun's bearing, so each cell's only
 * possible occluder is the cell before it in its own column.
 */
export const HOME_SHADOW = {
    homeShadow: { value: null as T.Texture | null },
    /** Origin x and z, x gained per metre of z along a column, cell size. */
    homeShadowFrame: { value: new T.Vector4(0, 0, 0, 1) },
    homeShadowSize: { value: new T.Vector2(0, 0) },
};

const HOME_SHADOW_GLSL = `
    uniform sampler2D homeShadow; uniform vec4 homeShadowFrame; uniform vec2 homeShadowSize;
    float homeSunlit(vec3 place) {
        float along = place.z - homeShadowFrame.y;
        vec2 cell = vec2(place.x - homeShadowFrame.x - homeShadowFrame.z * along, along) / homeShadowFrame.w;
        // Sampled everywhere, weighted afterwards: see the ground's shader.
        float top = texture2D(homeShadow, (cell + .5) / max(homeShadowSize, vec2(1.))).r;
        vec2 inside = step(vec2(0.), cell) * step(cell, homeShadowSize - 1.);
        return mix(1., smoothstep(-.05, .45, place.y - top), inside.x * inside.y);
    }`;

/**
 * The survey aircraft's instrument, for every surface it passes over. A fan
 * of laser light leaves one point; where the fan meets whatever stands under
 * it there is a line, and the points just measured linger behind the line
 * before they fade. The aircraft also stands between the sun and the ground.
 * Both fall on everything, so they are published with the sun's shadow to
 * every material that calls `applyHomeHaze`. At rest they are zero.
 */
export const HOME_SURVEY = {
    /** The instrument's place, and how brightly it is working (0 to 1). */
    homeScanFrom: { value: new T.Vector4(0, 0, 0, 0) },
    /** The fan's plane by its normal, then how fast it is crossing (-1 to 1). */
    homeScanPlane: { value: new T.Vector4(0, 0, 1, 0) },
    /** The middle of the fan, and the cosine of half its spread. */
    homeScanAxis: { value: new T.Vector4(0, -1, 0, 0.77) },
    /** The aircraft's centre, and how much of the sun it stops (0 to 1). */
    homeFlyer: { value: new T.Vector4(0, 0, 0, 0) },
};

/** Scene-referred colour of the instrument's light. */
export const HOME_SCAN_COLOR = [0.3, 0.86, 0.78];

const HOME_SURVEY_GLSL = `
    uniform vec4 homeScanFrom, homeScanPlane, homeScanAxis, homeFlyer;
    // Across the sun's rays a six-rotor aircraft is a small dark body inside
    // a wide, shallow blur of arms and turning blades.
    float homeFlyerLit(vec3 place, vec3 sun) {
        vec3 toward = homeFlyer.xyz - place;
        float along = dot(toward, sun);
        vec3 miss = toward - sun * along;
        vec3 level = normalize(vec3(sun.z, 0., -sun.x));
        vec2 across = vec2(dot(miss, level), dot(miss, cross(level, sun)));
        float soft = .06 + along * .012;
        float body = 1. - smoothstep(1. - soft * 2., 1. + soft * 2., length(across / vec2(.5, .3)));
        float span = 1. - smoothstep(1. - soft, 1. + soft, length(across / vec2(1.45, .4)));
        return 1. - homeFlyer.w * max(body * .82, span * .34) * smoothstep(.2, 1., along);
    }
    vec3 homeScanLight(vec3 place, float upward) {
        vec3 toward = place - homeScanFrom.xyz;
        float range = max(length(toward), .05);
        float off = dot(toward, homeScanPlane.xyz);
        // A hair's width up close, and never thinner than a screen can draw.
        float width = max(.005 + .0016 * range, fwidth(off) * .85);
        float line = exp(-off * off / (width * width));
        float glow = exp(-abs(off) / (.04 + .01 * range));
        // What the line has just crossed keeps its measured points a moment:
        // a lattice a hand's width apart, fixed to the surface itself.
        float behind = -off * sign(homeScanPlane.w) / range;
        float fresh = step(0., behind) * exp(-behind * 11.) * abs(homeScanPlane.w);
        vec3 cell = place * 9.;
        vec3 fine = fwidth(cell);
        vec3 ruled = (1. - smoothstep(0., 1.25, (.5 - abs(fract(cell) - .5)) / max(fine, vec3(1e-4))))
            * (1. - smoothstep(.22, .5, fine));
        // Level ground is ruled in squares; only what stands up is ruled
        // by height as well.
        ruled.y *= 1. - smoothstep(.45, .8, upward);
        float lattice = max(ruled.x, max(ruled.y, ruled.z));
        float within = smoothstep(homeScanAxis.w - .035, homeScanAxis.w + .01, dot(toward / range, homeScanAxis.xyz));
        float reach = smoothstep(.8, 1.6, range) * (1. - smoothstep(24., 38., range));
        return ${vec3(HOME_SCAN_COLOR)} * (line * 3.4 + glow * .14 + fresh * (lattice * .8 + .05))
            * within * reach * homeScanFrom.w;
    }`;

/**
 * Replaces the flat fog colour with the horizon colour behind each fragment,
 * takes the sun off whatever the terrain or the aircraft shades, and adds
 * the instrument's light.
 */
export function applyHomeHaze(shader: {
    fragmentShader: string;
    uniforms: Record<string, T.IUniform>;
}) {
    shader.uniforms.homeSun = { value: HOME_SUN_DIRECTION };
    Object.assign(shader.uniforms, HOME_SHADOW, HOME_SURVEY);
    shader.fragmentShader = shader.fragmentShader
        .replace(
            "#include <fog_pars_fragment>",
            `#include <fog_pars_fragment>
            uniform vec3 homeSun;
            ${HOME_SKY_GLSL}
            ${HOME_SHADOW_GLSL}
            ${HOME_SURVEY_GLSL}`,
        )
        .replace(
            "#include <lights_fragment_end>",
            `#include <lights_fragment_end>
            vec3 homePlace = cameraPosition - vViewPosition * mat3(viewMatrix);
            float homeLit = homeSunlit(homePlace) * homeFlyerLit(homePlace, homeSun);
            reflectedLight.directDiffuse *= homeLit;
            reflectedLight.directSpecular *= homeLit;`,
        )
        .replace(
            "#include <fog_fragment>",
            `gl_FragColor.rgb += homeScanLight(cameraPosition - vViewPosition * mat3(viewMatrix), abs(dot(normal, viewMatrix[1].xyz)));
            #ifdef USE_FOG
                // Dust lies low: a sight line that climbs out of it clears
                // sooner than one that stays near the ground, so tall
                // things stand out of the haze that hides their feet.
                vec3 hazeToward = -vViewPosition * mat3(viewMatrix);
                float hazeRise = hazeToward.y / ${HOME_HAZE_HEIGHT.toFixed(1)};
                float hazeThin = abs(hazeRise) > .001 ? (1. - exp(-hazeRise)) / hazeRise : 1.;
                float hazeDepth = fogDensity * length(hazeToward) * hazeThin * exp(-max(cameraPosition.y, 0.) / ${HOME_HAZE_HEIGHT.toFixed(1)});
                float hazeFactor = 1. - exp(-hazeDepth * hazeDepth);
                gl_FragColor.rgb = mix(gl_FragColor.rgb, homeHaze(normalize(hazeToward), homeSun), hazeFactor);
            #endif`,
        );
}

/**
 * Haze, plus the regolith that settles on anything standing in it: surfaces
 * near the ground take the ground's colour and lose their sheen, which ties
 * built things to the terrain they stand on. `ground` is the height of that
 * terrain where the thing stands.
 */
export const homeFinishAt =
    (ground: number) =>
    (shader: {
        fragmentShader: string;
        uniforms: Record<string, T.IUniform>;
    }) => {
        applyHomeHaze(shader);
        shader.uniforms.homeGround = { value: ground };
        shader.fragmentShader = shader.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
                uniform float homeGround;`,
            )
            .replace(
                "#include <metalnessmap_fragment>",
                `#include <metalnessmap_fragment>
                vec3 dustWorld = cameraPosition - vViewPosition * mat3(viewMatrix);
                float dust = (1. - smoothstep(-.3, 1.7, dustWorld.y - homeGround)) * .5;
                diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.24, .17, .12), dust);
                roughnessFactor = mix(roughnessFactor, .96, dust);
                metalnessFactor *= 1. - dust;`,
            );
    };

/** The same, for everything that stands at the scene's own level. */
export const applyHomeFinish = homeFinishAt(0);

/**
 * Built hardware carries three values at every vertex, measured when the
 * model was made: how much sky it can see, where grime settles, and which
 * edges get worn. They shade what no screen-space pass can reach: the
 * crevice under a flange, the belly of a tank, the bright lip of a hatch.
 * `wear` is how readily this finish rubs through to bright metal.
 */
export function applyHomeSurface(
    shader: {
        vertexShader: string;
        fragmentShader: string;
        uniforms: Record<string, T.IUniform>;
    },
    wear: number,
) {
    shader.uniforms.surfaceWear = { value: wear };
    shader.vertexShader = shader.vertexShader
        .replace(
            "#include <common>",
            `#include <common>
            attribute vec3 surface;
            varying vec3 vSurface;`,
        )
        .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
            vSurface = surface;`,
        );
    shader.fragmentShader = shader.fragmentShader
        .replace(
            "#include <common>",
            `#include <common>
            uniform float surfaceWear;
            varying vec3 vSurface;`,
        )
        .replace(
            "#include <metalnessmap_fragment>",
            `#include <metalnessmap_fragment>
            float grime = clamp(vSurface.g, 0., 1.);
            float worn = clamp(vSurface.b, 0., 1.) * surfaceWear;
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.19, .14, .1), grime * .7);
            roughnessFactor = mix(roughnessFactor, .95, grime * .8);
            metalnessFactor *= 1. - grime * .8;
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.8, .8, .78), worn);
            metalnessFactor = mix(metalnessFactor, 1., worn);
            roughnessFactor = mix(roughnessFactor, .3, worn);`,
        )
        .replace(
            "#include <aomap_fragment>",
            `#include <aomap_fragment>
            float skyOpen = clamp(vSurface.r, 0., 1.);
            reflectedLight.indirectDiffuse *= skyOpen;
            reflectedLight.indirectSpecular *= mix(1., skyOpen, .85);
            // The shadow map cannot resolve a crevice; lose some sun there too.
            reflectedLight.directDiffuse *= mix(1., skyOpen, .3);
            reflectedLight.directSpecular *= mix(1., skyOpen, .3);`,
        );
}

const sky = (direction: T.Vector3, target: T.Color) => {
    const flat = Math.hypot(direction.x, direction.z) || 1;
    const sunFlat = Math.hypot(HOME_SUN_DIRECTION.x, HOME_SUN_DIRECTION.z);
    const facing =
        (direction.x * HOME_SUN_DIRECTION.x +
            direction.z * HOME_SUN_DIRECTION.z) /
        (flat * sunFlat);
    const toward = Math.pow(T.MathUtils.clamp(facing * 0.5 + 0.5, 0, 1), 4);
    const height = Math.max(direction.y, 0);
    const band = 0.7 * Math.exp(-height * 15) + 0.3 * Math.exp(-height * 5);
    const away = Math.max(0, 1 - direction.dot(HOME_SUN_DIRECTION));
    const halo = 0.42 * Math.exp(-away * 9),
        core = 1.6 * Math.exp(-away * 150);
    return target.setRGB(
        T.MathUtils.lerp(
            ZENITH[0],
            T.MathUtils.lerp(HORIZON_AWAY[0], HORIZON_SUN[0], toward),
            band,
        ) +
            HALO[0] * halo +
            CORE[0] * core,
        T.MathUtils.lerp(
            ZENITH[1],
            T.MathUtils.lerp(HORIZON_AWAY[1], HORIZON_SUN[1], toward),
            band,
        ) +
            HALO[1] * halo +
            CORE[1] * core,
        T.MathUtils.lerp(
            ZENITH[2],
            T.MathUtils.lerp(HORIZON_AWAY[2], HORIZON_SUN[2], toward),
            band,
        ) +
            HALO[2] * halo +
            CORE[2] * core,
    );
};

/** Reflections see the sky the camera sees, above sunlit and shaded ground. */
export function makeHomeEnvironment(renderer: T.WebGLRenderer) {
    const width = 256,
        height = 128;
    const pixels = new Float32Array(width * height * 4);
    const color = new T.Color();
    const horizon = new T.Color();
    const direction = new T.Vector3();
    for (let y = 0; y < height; y++) {
        const latitude = ((y + 0.5) / height - 0.5) * Math.PI;
        for (let x = 0; x < width; x++) {
            const longitude = ((x + 0.5) / width - 0.5) * Math.PI * 2;
            direction.set(
                Math.cos(latitude) * Math.cos(longitude),
                Math.sin(latitude),
                Math.cos(latitude) * Math.sin(longitude),
            );
            sky(direction, color);
            if (direction.y < 0) {
                // Dusty ground: brighter toward the sun, where it is seen
                // against the light, and never brighter than its horizon.
                const facing =
                    direction.x * HOME_SUN_DIRECTION.x +
                    direction.z * HOME_SUN_DIRECTION.z;
                const lit = 0.05 + 0.07 * Math.max(0, facing);
                horizon.copy(color);
                color
                    .setRGB(lit * 1.25, lit * 0.82, lit * 0.56)
                    .lerp(horizon, Math.exp(direction.y * 14));
            }
            const offset = (y * width + x) * 4;
            color.toArray(pixels, offset);
            pixels[offset + 3] = 1;
        }
    }
    const source = new T.DataTexture(
        pixels,
        width,
        height,
        T.RGBAFormat,
        T.FloatType,
    );
    source.mapping = T.EquirectangularReflectionMapping;
    source.needsUpdate = true;
    const generator = new T.PMREMGenerator(renderer);
    const environment = generator.fromEquirectangular(source);
    source.dispose();
    generator.dispose();
    return environment;
}
