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

// The same world-space light direction drives the surface, cities and atmosphere.
export async function makePlanet(
    T: typeof Three,
    world: World,
    small: boolean,
    texture: TextureLoader,
    sunlight: Three.Vector3,
) {
    const group = new T.Group();
    const suffix = small ? "1k" : "2k";
    try {
        const map = await texture(
            world === "earth" && !small
                ? "earth-cinematic-4k"
                : world === "saturn"
                  ? "saturn-strip-v1"
                  : world === "moon"
                    ? "moon-1k"
                    : `${world}-${suffix}`,
        );
        const geometry = new T.SphereGeometry(1, 128, 96);
        if (world === "earth") {
            const [clouds, night, water] = await Promise.all([
                texture(`earth-clouds-${suffix}`, false),
                texture("earth-night-2k"),
                texture("earth-water-1k", false),
            ]);
            const surface = new T.ShaderMaterial({
                uniforms: {
                    dayMap: { value: map },
                    cloudMap: { value: clouds },
                    nightMap: { value: night },
                    waterMap: { value: water },
                    sunDirection: { value: sunlight },
                },
                vertexShader: `varying vec2 vUv; varying vec3 vNormal; varying vec3 vPosition;
                void main(){vUv=uv; vec4 p=modelMatrix*vec4(position,1.); vNormal=normalize(mat3(modelMatrix)*normal); vPosition=p.xyz; gl_Position=projectionMatrix*viewMatrix*p;}`,
                fragmentShader: `uniform sampler2D dayMap,cloudMap,nightMap,waterMap; uniform vec3 sunDirection; varying vec2 vUv; varying vec3 vNormal,vPosition;
                void main(){
                    vec3 n=normalize(vNormal), v=normalize(cameraPosition-vPosition), l=normalize(sunDirection);
                    float nl=dot(n,l), daylight=smoothstep(-.12,.22,nl);
                    vec3 land=texture2D(dayMap,vUv).rgb;
                    float luminance=dot(land,vec3(.2126,.7152,.0722));
                    land=mix(vec3(luminance),land,.78);
                    float ocean=texture2D(waterMap,vUv).r;
                    land=mix(land,land*vec3(.35,.55,.7),ocean*.85);
                    float diffuse=max(nl,0.);
                    vec3 color=land*(.012+diffuse*1.35);
                    float spec=pow(max(dot(reflect(-l,n),v),0.),95.)*ocean;
                    color+=vec3(.52,.68,.8)*spec*.10;
                    float cloudShadow=texture2D(cloudMap,vUv+vec2(.002,-.001)).r;
                    color*=1.-cloudShadow*.24*daylight;
                    vec3 cities=texture2D(nightMap,vUv).rgb;
                    color+=cities*vec3(2.7,1.45,.55)*(1.-smoothstep(-.2,.12,nl));
                    float rim=pow(1.-max(dot(n,v),0.),3.8);
                    color+=vec3(.12,.38,.65)*rim*daylight*.35;
                    gl_FragColor=vec4(color,1.);
                    #include <tonemapping_fragment>
                    #include <colorspace_fragment>
                }`,
            });
            group.add(new T.Mesh(geometry, surface));
            const cloud = new T.Mesh(
                new T.SphereGeometry(1.006, 128, 96),
                new T.MeshStandardMaterial({
                    color: 0xe8edf1,
                    alphaMap: clouds,
                    transparent: true,
                    opacity: 0.85,
                    depthWrite: false,
                    roughness: 1,
                }),
            );
            group.add(cloud);
            const atmosphere = new T.ShaderMaterial({
                uniforms: { sunDirection: { value: sunlight } },
                vertexShader: `varying vec3 vNormal,vPosition; void main(){vec4 p=modelMatrix*vec4(position,1.);vNormal=normalize(mat3(modelMatrix)*normal);vPosition=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
                fragmentShader: `uniform vec3 sunDirection;varying vec3 vNormal,vPosition;void main(){vec3 n=normalize(vNormal),v=normalize(cameraPosition-vPosition);float rim=pow(1.-abs(dot(n,v)),4.5);float light=smoothstep(-.3,.7,dot(n,sunDirection));gl_FragColor=vec4(mix(vec3(.09,.24,.48),vec3(.28,.65,1.),light),rim*(.12+light*.62));}`,
                transparent: true,
                blending: T.AdditiveBlending,
                depthWrite: false,
            });
            group.add(
                new T.Mesh(new T.SphereGeometry(1.022, 128, 96), atmosphere),
            );
            group.rotation.y = 0;
            group.rotation.z = -0.14;
        } else {
            const surface = new T.Mesh(
                geometry,
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
