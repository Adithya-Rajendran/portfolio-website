import type * as Three from "three";

type World = "moon" | "mars";
type Shader = {
    vertexShader: string;
    fragmentShader: string;
    uniforms: Record<string, Three.IUniform>;
};

/**
 * The air over a settlement. The Moon has none: its sky is black down to
 * the ground and a kilometre away is as sharp as a metre away. Mars keeps
 * fine dust aloft, which lights the sky from the horizon up, veils whatever
 * is far, and rings the sun in blue, since that dust scatters blue light
 * forward and absorbs it everywhere else. Colours are scene-referred linear.
 */
const AIR: Record<
    World,
    | undefined
    | {
          /** The dust looking away from the sun, and toward it. */
          away: [number, number, number];
          sunward: [number, number, number];
          halo: [number, number, number];
          /** How much a metre of ground-level air hides. */
          density: number;
          /** The height over which the dust thins to a third, in metres. */
          height: number;
      }
> = {
    moon: undefined,
    mars: {
        away: [0.2, 0.145, 0.115],
        sunward: [0.62, 0.4, 0.24],
        halo: [0.5, 0.66, 1],
        density: 0.0013,
        height: 46,
    },
};

const vec3 = (value: readonly number[]) =>
    `vec3(${value.map((part) => part.toFixed(4)).join(",")})`;

/** What the hardware of a world reflects and is filled by, from its air. */
export const settlementAir = (world: World) => AIR[world];

/**
 * One world's air: `inject` veils a standard material with distance, `sky`
 * is the dome that lights the horizon (undefined where there is no air),
 * and `update` keeps both where the camera and the settlement are.
 */
export function makeSettlementAir(T: typeof Three, world: World) {
    const air = AIR[world];
    const uniforms = {
        /** The globe's centre and the settlement's distance from it. */
        airGlobe: { value: new T.Vector4(0, 0, 0, 1) },
        /** Toward the sun. */
        airSun: { value: new T.Vector3(1, 0, 0) },
        /** Hidden per world unit; scale height in world units; shown. */
        airHaze: { value: new T.Vector3(0, 1, 0) },
    };
    const declared = `uniform vec4 airGlobe;
        uniform vec3 airSun;
        uniform vec3 airHaze;`;
    const dust = air
        ? `vec3 airDust(vec3 ray) {
            vec3 down = normalize(airGlobe.xyz - cameraPosition);
            vec3 level = ray - down * dot(ray, down);
            vec3 sunLevel = airSun - down * dot(airSun, down);
            float bearing = dot(level, sunLevel) / max(length(level) * length(sunLevel), 1e-5);
            return mix(${vec3(air.away)}, ${vec3(air.sunward)}, pow(clamp(bearing * .5 + .5, 0., 1.), 3.));
        }`
        : "";

    let sky: Three.Mesh | undefined;
    if (air) {
        sky = new T.Mesh(
            new T.SphereGeometry(1, 48, 24),
            new T.ShaderMaterial({
                side: T.BackSide,
                transparent: true,
                depthWrite: false,
                // What is written is already weighted by how much it hides.
                blending: T.CustomBlending,
                blendSrc: T.OneFactor,
                blendDst: T.OneMinusSrcAlphaFactor,
                blendSrcAlpha: T.OneFactor,
                blendDstAlpha: T.OneMinusSrcAlphaFactor,
                uniforms,
                vertexShader: `varying vec3 vToward;
                    void main() {
                        vToward = position;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
                    }`,
                fragmentShader: `${declared}
                    varying vec3 vToward;
                    ${dust}
                    void main() {
                        vec3 ray = normalize(vToward);
                        vec3 down = airGlobe.xyz - cameraPosition;
                        float far = length(down);
                        down /= far;
                        // How far above the ground's edge this is looking.
                        float limb = asin(clamp(airGlobe.w / far, 0., 1.));
                        float above = max(acos(clamp(dot(ray, down), -1., 1.)) - limb, 0.);
                        // A bright band hugs the horizon under a long tail,
                        // and thins as the camera climbs out of the dust.
                        float low = exp(-max(far - airGlobe.w, 0.) / (airHaze.y * 4.));
                        float veil = clamp(.9 * exp(-above * 8.) + .34 * exp(-above * 2.) + .05, 0., 1.) * low;
                        float gap = max(0., 1. - dot(ray, airSun));
                        vec3 glow = ${vec3(air.halo)} * (.5 * exp(-gap * 9.) + 1.3 * exp(-gap * 120.))
                            + vec3(1., .95, .88) * 9. * exp(-gap * 9000.);
                        vec3 light = airDust(ray) * veil + glow * low;
                        // By day the dust hides the stars even where it is
                        // too thin overhead to be bright itself.
                        float hidden = clamp(max(veil, .97 * sqrt(low)) + .6 * (glow.r + glow.g + glow.b) * low, 0., 1.);
                        gl_FragColor = vec4(light, hidden) * airHaze.z;
                        #include <tonemapping_fragment>
                        #include <colorspace_fragment>
                    }`,
            }),
        );
        sky.name = `${world} sky`;
        sky.frustumCulled = false;
        // Under every other see-through thing: glass, flames, lamps.
        sky.renderOrder = -100;
        sky.visible = false;
    }

    const centre = new T.Vector3(),
        stands = new T.Vector3(),
        sized = new T.Vector3();
    return {
        sky,
        /** Distance softens a standard material's colour toward the dust. */
        inject(shader: Shader) {
            if (!air) return;
            Object.assign(shader.uniforms, uniforms);
            shader.vertexShader = shader.vertexShader
                .replace(
                    "#include <common>",
                    `#include <common>
                    varying vec3 vAirWorld;`,
                )
                .replace(
                    "#include <begin_vertex>",
                    `#include <begin_vertex>
                    vAirWorld = (modelMatrix * vec4(transformed, 1.)).xyz;`,
                );
            shader.fragmentShader = shader.fragmentShader
                .replace(
                    "#include <common>",
                    `#include <common>
                    ${declared}
                    varying vec3 vAirWorld;
                    ${dust}`,
                )
                .replace(
                    "#include <opaque_fragment>",
                    `#include <opaque_fragment>
                    {
                        vec3 airRay = vAirWorld - cameraPosition;
                        float airFar = length(airRay);
                        // Dust thins with height, so the air between the eye
                        // and a place is weighed over the heights it crosses.
                        float airEye = exp(-max(length(cameraPosition - airGlobe.xyz) - airGlobe.w, 0.) / airHaze.y);
                        float airThere = exp(-max(length(vAirWorld - airGlobe.xyz) - airGlobe.w, 0.) / airHaze.y);
                        float airRise = log(max(airEye, 1e-20) / max(airThere, 1e-20));
                        float airMean = abs(airRise) > .01 ? (airEye - airThere) / airRise : airEye;
                        float airVeil = (1. - exp(-airHaze.x * airFar * airMean)) * airHaze.z;
                        gl_FragColor.rgb = mix(gl_FragColor.rgb, airDust(airRay / airFar), airVeil);
                    }`,
                );
        },
        /**
         * `shown` is how far the view has come down to this settlement, 0
         * in orbit and 1 on the ground.
         */
        update(
            camera: Three.Camera,
            globe: Three.Object3D,
            outpost: Three.Object3D,
            sun: Three.Vector3,
            shown: number,
        ) {
            if (!air) return;
            globe.getWorldPosition(centre);
            outpost.getWorldPosition(stands);
            const metre = outpost.getWorldScale(sized).x;
            uniforms.airGlobe.value.set(
                centre.x,
                centre.y,
                centre.z,
                stands.distanceTo(centre),
            );
            uniforms.airSun.value.copy(sun).normalize();
            uniforms.airHaze.value.set(
                air.density / metre,
                air.height * metre,
                shown,
            );
            if (sky) {
                sky.visible = shown > 0.01;
                sky.position.copy(camera.position);
                sky.scale.setScalar(70);
            }
        },
        dispose() {
            sky?.geometry.dispose();
            (sky?.material as Three.Material | undefined)?.dispose();
        },
    };
}

export type SettlementAir = ReturnType<typeof makeSettlementAir>;
