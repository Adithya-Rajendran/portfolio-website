import type * as Three from "three";

export const worldNames = [
    "Earth",
    "Moon",
    "Mars",
    "Jupiter",
    "Saturn",
] as const;
export type World = Lowercase<(typeof worldNames)[number]>;
export type TextureLoader = (
    name: string,
    color?: boolean,
) => Promise<Three.Texture>;

export interface PlanetLighting {
    sunDirection: { value: Three.Vector3 };
    sunColor: { value: Three.Color };
    sunStrength: { value: number };
    ambientStrength: { value: number };
    twilightStrength: { value: number };
    cloudOffset: { value: number };
}

const earthVertex = `
    varying vec2 vUv;
    varying vec3 vNormal, vPosition, vTangent;
    void main() {
        vUv = uv;
        vec4 p = modelMatrix * vec4(position, 1.);
        vPosition = p.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vTangent = normalize(mat3(modelMatrix) * vec3(normal.z, 0., -normal.x));
        gl_Position = projectionMatrix * viewMatrix * p;
    }`;
const lightUniforms = `
    uniform vec3 sunDirection, sunColor;
    uniform float sunStrength, ambientStrength, twilightStrength, cloudOffset;
    varying vec2 vUv;
    varying vec3 vNormal, vPosition, vTangent;`;

// The same world-space light direction drives the surface, cities and atmosphere.
export async function makePlanet(
    T: typeof Three,
    world: World,
    small: boolean,
    texture: TextureLoader,
    lighting: PlanetLighting,
) {
    const group = new T.Group();
    const suffix = small ? "1k" : "2k";
    try {
        const map = await texture(
            world === "earth"
                ? `earth-surface-v2-${small ? "2k" : "8k"}`
                : world === "saturn"
                  ? "saturn-strip-v1"
                  : world === "moon"
                    ? "moon-1k"
                    : `${world}-${suffix}`,
        );
        if (world === "earth") {
            const [clouds, night, water, normal] = await Promise.all([
                texture(`earth-clouds-v2-${small ? "2k" : "4k"}`, false),
                texture(`earth-lights-v2-${small ? "2k" : "4k"}`),
                texture("earth-water-v2-2k", false),
                texture("earth-normal-v2-2k", false),
            ]);
            clouds.wrapS = T.RepeatWrapping;
            const surface = new T.ShaderMaterial({
                uniforms: {
                    ...lighting,
                    dayMap: { value: map },
                    cloudMap: { value: clouds },
                    nightMap: { value: night },
                    waterMap: { value: water },
                    normalMap: { value: normal },
                },
                vertexShader: earthVertex,
                fragmentShader: `${lightUniforms}
                uniform sampler2D dayMap, cloudMap, nightMap, waterMap, normalMap;
                void main(){
                    vec3 n = normalize(vNormal), v = normalize(cameraPosition-vPosition), l = normalize(sunDirection);
                    vec3 t = normalize(vTangent), b = normalize(cross(n,t));
                    vec3 relief = texture2D(normalMap,vUv).xyz * 2. - 1.;
                    float ocean = texture2D(waterMap,vUv).r;
                    vec3 detailed = normalize(mat3(t,b,n) * normalize(vec3(relief.xy*.38*(1.-ocean),relief.z)));
                    float nl = dot(n,l), diffuse = max(dot(detailed,l),0.);
                    float daylight = smoothstep(-.08,.18,nl);
                    vec3 albedo = texture2D(dayMap,vUv).rgb;
                    float luminance = dot(albedo,vec3(.2126,.7152,.0722));
                    albedo = mix(vec3(luminance),albedo,.86);
                    albedo = mix(albedo,albedo*vec3(.38,.62,.78),ocean*.72);
                    vec3 color = albedo*(vec3(.35,.56,.8)*ambientStrength + sunColor*diffuse*sunStrength);
                    vec2 cloudUv = vUv + vec2(cloudOffset,0.);
                    vec2 shadowOffset = vec2(dot(l,t),dot(l,b))*.0032;
                    float shadow = texture2D(cloudMap,cloudUv+shadowOffset).r;
                    color *= 1. - shadow*.38*daylight;
                    float fresnel = .025 + .30*pow(1.-max(dot(n,v),0.),5.);
                    float spec = pow(max(dot(normalize(l+v),n),0.),160.)*ocean*daylight;
                    color += sunColor*spec*fresnel*sunStrength*.65*(1.-shadow);
                    vec3 cities = texture2D(nightMap,vUv).rgb;
                    // Black ocean pixels stay black; small warm settlements survive the terminator.
                    cities = max(cities-vec3(.004),vec3(0.));
                    color += cities*vec3(1.9,1.35,.8)*(1.-smoothstep(-.15,.1,nl))*(1.-shadow*.65);
                    float rim = pow(1.-max(dot(n,v),0.),3.2);
                    float sunset = exp(-abs(nl)*14.)*twilightStrength;
                    color += vec3(.08,.27,.52)*rim*(.08+daylight*.32);
                    color += vec3(.65,.21,.055)*sunset*rim*.28;
                    gl_FragColor=vec4(color,1.);
                    #include <tonemapping_fragment>
                    #include <colorspace_fragment>
                }`,
            });
            group.add(
                new T.Mesh(
                    new T.SphereGeometry(1, small ? 128 : 192, 128),
                    surface,
                ),
            );
            const cloud = new T.Mesh(
                new T.SphereGeometry(1.008, small ? 128 : 192, 128),
                new T.ShaderMaterial({
                    uniforms: {
                        ...lighting,
                        cloudMap: { value: clouds },
                        texel: { value: 1 / (small ? 2048 : 4096) },
                    },
                    vertexShader: earthVertex,
                    fragmentShader: `${lightUniforms}
                        uniform sampler2D cloudMap; uniform float texel;
                        void main() {
                            vec2 uv = vUv + vec2(cloudOffset,0.);
                            float density = texture2D(cloudMap,uv).r;
                            vec3 n=normalize(vNormal), l=normalize(sunDirection);
                            vec3 t=normalize(vTangent), b=normalize(cross(n,t));
                            vec2 gradient=vec2(texture2D(cloudMap,uv+vec2(texel,0.)).r-texture2D(cloudMap,uv-vec2(texel,0.)).r,
                                texture2D(cloudMap,uv+vec2(0.,texel)).r-texture2D(cloudMap,uv-vec2(0.,texel)).r);
                            vec3 puff=normalize(n-t*gradient.x*.8-b*gradient.y*.8);
                            float nl=dot(n,l);
                            float light=max(dot(puff,l),0.);
                            float twilight=exp(-abs(nl)*12.)*twilightStrength;
                            vec3 color=vec3(.32,.49,.7)*ambientStrength*1.8 + sunColor*light*sunStrength;
                            color+=vec3(.48,.12,.028)*twilight*.26;
                            gl_FragColor=vec4(color,smoothstep(.035,.86,density)*.96);
                            #include <tonemapping_fragment>
                            #include <colorspace_fragment>
                        }`,
                    transparent: true,
                    depthWrite: false,
                }),
            );
            group.add(cloud);
            const atmosphere = new T.ShaderMaterial({
                uniforms: { ...lighting },
                vertexShader: earthVertex,
                fragmentShader: `${lightUniforms}
                    void main(){
                        vec3 n=normalize(vNormal),v=normalize(cameraPosition-vPosition);
                        float facing=abs(dot(n,v));
                        float rim=pow(1.-facing,5.5);
                        float nl=dot(n,normalize(sunDirection));
                        float light=smoothstep(-.35,.5,nl);
                        float twilight=exp(-abs(nl)*9.)*twilightStrength;
                        vec3 scattering=mix(vec3(.08,.2,.42),vec3(.19,.54,.92),light);
                        scattering=mix(scattering,vec3(.95,.38,.12),twilight*.5);
                        gl_FragColor=vec4(scattering,rim*(.13+light*.7));
                        #include <colorspace_fragment>
                    }`,
                transparent: true,
                blending: T.AdditiveBlending,
                depthWrite: false,
                side: T.BackSide,
            });
            group.add(
                new T.Mesh(new T.SphereGeometry(1.025, 192, 128), atmosphere),
            );
            group.rotation.y = 0;
            group.rotation.z = -0.14;
        } else {
            const surface = new T.Mesh(
                new T.SphereGeometry(1, small ? 128 : 192, 128),
                new T.MeshStandardMaterial({
                    map,
                    roughness: 0.95,
                    metalness: 0,
                }),
            );
            surface.castShadow = world === "saturn";
            surface.receiveShadow = world === "saturn";
            group.add(surface);
        }
        if (world === "saturn") {
            const ringMap = await texture("saturn-ring-1k");
            const ringGeometry = new T.RingGeometry(1.25, 2.15, 192, 1);
            const positions = ringGeometry.attributes.position,
                uv = ringGeometry.attributes.uv;
            for (let i = 0; i < positions.count; i++)
                uv.setXY(
                    i,
                    (Math.hypot(positions.getX(i), positions.getY(i)) - 1.25) /
                        0.9,
                    0.5,
                );
            const rings = new T.Mesh(
                ringGeometry,
                new T.MeshStandardMaterial({
                    map: ringMap,
                    transparent: true,
                    side: T.DoubleSide,
                    roughness: 1,
                    alphaTest: 0.06,
                }),
            );
            rings.rotation.x = Math.PI / 2;
            rings.castShadow = true;
            rings.receiveShadow = true;
            group.add(rings);
            group.rotation.z = 0.24;
            group.rotation.x = 0.23;
        }
        return group;
    } catch (error) {
        disposePlanet(group);
        throw error;
    }
}

export function disposePlanet(group: Three.Object3D) {
    group.traverse((object) => {
        const mesh = object as Three.Mesh;
        mesh.geometry?.dispose();
        if (mesh.material)
            (Array.isArray(mesh.material)
                ? mesh.material
                : [mesh.material]
            ).forEach((material) => material.dispose());
    });
}
