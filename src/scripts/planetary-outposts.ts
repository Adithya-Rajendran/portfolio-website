import type * as Three from "three";
import type { SettlementAir } from "./settlement-air";
import type { SettlementLandmark, SettlementSite } from "./settlement-ground";
import { readSkyline, type Skyline } from "./settlement-skyline";

// An illustrated scale lets a whole city read from orbit. The geometry stays
// attached to the same globe during descent; metres below are model metres.
export const OUTPOST_SCALE = 0.00065;
const radiusInMetres = 1 / OUTPOST_SCALE;
/** How far from its globe's centre a settlement's ground stands, in radii. */
const OUTPOST_BASE = 1.0016;
/**
 * Where a camera may go over a settlement, in the scene's units: down to 3 m
 * over the ground it draws, anywhere within 400 m of its centre. By 520 m
 * out the globe's own ridges have to be cleared again.
 */
export const SETTLEMENT_FLOOR = {
    radius: OUTPOST_BASE + 3 * OUTPOST_SCALE,
    reach: 400 * OUTPOST_SCALE,
    beyond: 520 * OUTPOST_SCALE,
};

export function curveSurfacePoint(point: Three.Vector3) {
    point.y +=
        Math.sqrt(
            Math.max(1, radiusInMetres ** 2 - point.x ** 2 - point.z ** 2),
        ) - radiusInMetres;
    return point;
}

/**
 * Whether anything of a settlement can be seen past the globe's horizon.
 * A point at height h is visible when its angle from the camera's sub-point is
 * at most acos(1/distance) + acos(1/(1+h)), so a footprint of angular radius
 * `reach` (radians on the unit globe) and a top at `height` is hidden only
 * when its centre is beyond all three terms. The test is conservative.
 */
export function settlementMayShow(
    cosine: number,
    distance: number,
    reach: number,
    height: number,
) {
    // Inside the globe's radius the horizon maths does not apply.
    if (!(distance > 1)) return true;
    return (
        Math.acos(Math.min(1, Math.max(-1, cosine))) <=
        Math.acos(1 / distance) +
            Math.acos(1 / (1 + Math.max(0, height))) +
            Math.max(0, reach)
    );
}

/**
 * The meshes of a settlement, with the extents the horizon test needs and
 * the parts of it that turn.
 */
export interface SettlementParts {
    meshes: Three.Mesh[];
    reach: number;
    height: number;
    /** Centrifuge rings and the like: each turns about its own upright. */
    spinners: Three.Group[];
    /**
     * Every part the site moves, by the name of its node in the model: the
     * rings, the launch sled and its cargo, a lander, a transit pod. Each is
     * modelled about its own origin and seated where that origin stands.
     */
    movers: Map<string, Three.Group>;
    /** Brightness the site drives: the launch track's coils. */
    drive?: { coil: { value: Three.Vector4 } };
}

/** Nodes of the model that stay rigid and are moved by the site. */
const MOVER = /^(spin|launch|fly|ride)_/;

/**
 * The ground's own upright at a point of the model. Hardware is lowered onto
 * the globe, not turned, so a part that must sit flat on the ground there
 * (a ring on its track, a lander on its pad) is tilted to this.
 */
export function surfaceUpright(point: Three.Vector3, target: Three.Vector3) {
    const below = Math.sqrt(
        Math.max(1, radiusInMetres ** 2 - point.x ** 2 - point.z ** 2),
    );
    return target.set(point.x / below, 1, point.z / below).normalize();
}

/** The air over a settlement: its sky, and what distance does there. */
export function settlementAirOf(group: Three.Object3D) {
    return group.userData.air as SettlementAir | undefined;
}

/** Which settlement a group is, and where its named structures stand. */
export interface SettlementPlan {
    world: "moon" | "mars";
    landmarks: SettlementLandmark[];
    /** What stands between a view and a structure, where the site says. */
    skyline?: Skyline;
}

export function settlementPlan(group: Three.Object3D) {
    return group.userData.plan as SettlementPlan | undefined;
}

export function settlementParts(group: Three.Object3D) {
    return group.userData.settlement as SettlementParts | undefined;
}

export function attachOutpost(
    T: typeof Three,
    group: Three.Group,
    planet: Three.Group,
    world: "moon" | "mars",
) {
    const normal = new T.Vector3(
        world === "moon" ? 0.08 : -0.12,
        0.94,
        world === "moon" ? 0.33 : 0.4,
    ).normalize();
    group.position.copy(normal).multiplyScalar(OUTPOST_BASE);
    group.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), normal);
    group.scale.setScalar(OUTPOST_SCALE);
    group.userData.surfaceNormal = normal;
    group.userData.planetAttached = true;
    planet.add(group);
    // Its hardware reflects the ground it stands on, wherever that faces.
    group.updateWorldMatrix(true, false);
    (group.userData.orient as ((turn: Three.Quaternion) => void) | undefined)?.(
        group.getWorldQuaternion(new T.Quaternion()),
    );
}

/**
 * The tour rides beside the satellite until this second, is slowed to a stand
 * short of the muzzle over the seconds after, watches the satellite go from
 * there, and takes its place under the muzzle between the last two.
 */
const CHASE_UNTIL = 8.6,
    CHASE_SLOWING = 2.4,
    MUZZLE_FROM = 12,
    MUZZLE_AT = 16;
/** The second of the launch the chasing camera has reached by `time`. */
const chaseClock = (time: number) => {
    const slowing = Math.min(Math.max(time - CHASE_UNTIL, 0), CHASE_SLOWING);
    return (
        Math.min(time, CHASE_UNTIL) +
        slowing -
        (slowing * slowing) / (2 * CHASE_SLOWING)
    );
};
/** How far the camera's eye goes with the satellite once it has left. */
const FOLLOWED = 0.45;

type Keyframe = {
    at: number;
    camera: number[];
    target: number[];
    landmark: string;
};
// Every view looks toward the low sun or across it, from a few storeys up:
// forms turn from a lit edge into shade, shadows reach toward the camera,
// lamps and windows carry the near sides, and the horizon is in the frame.
// A view from high overhead with the sun behind it shows a model on a table.
//
// Moon positions share the launch clock (see lunar-launch.ts): arrive at the
// breech hall, ride out beside the satellite and watch it leave, then stand
// off the muzzle and close on it while cargo is thrown: from there a canister
// leaves across the face of the Earth. Back over the town to Main Street and
// under the driver's piers before the next launch.
const tours: Record<"moon" | "mars", Keyframe[]> = {
    moon: [
        {
            at: 0,
            camera: [-62, 26, 150],
            target: [40, 12, 40],
            landmark: "Selene · A company port on the Moon",
        },
        {
            at: 5,
            camera: [-3, 18, 163],
            target: [43, 12, 63],
            landmark: "Mass driver · Ten coil sectors, a power house to each",
        },
        {
            at: 10,
            camera: [1, 47, -26],
            target: [47, 46, -170],
            landmark: "Mass driver · A satellite to orbit, no propellant spent",
        },
        {
            at: MUZZLE_FROM,
            camera: [1, 47, -26],
            target: [47, 46, -170],
            landmark: "Muzzle · The sled is caught, and runs back for cargo",
        },
        {
            at: MUZZLE_AT,
            camera: [3, 17, -50],
            target: [48.6, 38, -148],
            landmark: "Muzzle · Canisters of lunar oxygen, thrown to orbit",
        },
        {
            at: 22,
            camera: [15, 22, -69],
            target: [60.6, 43, -167],
            landmark: "Selene · Quarters under three metres of regolith",
        },
        {
            at: 27,
            camera: [1, 22, 72],
            target: [1, 6, -60],
            landmark: "Main Street · One gallery and one utilidor join it all",
        },
        {
            at: 31.5,
            camera: [30.5, 10, 58],
            target: [34, 7, -60],
            landmark: "Pulse-power yard · A sector house under every pier",
        },
        {
            at: 36,
            camera: [-62, 26, 150],
            target: [40, 12, 40],
            landmark: "Selene · A company port on the Moon",
        },
    ],
    // Mars: over the solar farm to the head of the main street, down it to
    // the square, up to face the gate and the ship beyond it, then round to
    // the biosphere at the head of Canal Street. A view this wide (about 45
    // degrees) holds a 57 m ship only from 110 m or more.
    mars: [
        {
            at: 0,
            camera: [-140, 44, 100],
            target: [-20, 16, -20],
            landmark: "Ares · A grid city grown from its landing site",
        },
        {
            at: 8,
            camera: [-108, 9, -13.5],
            target: [40, 17, -13],
            landmark: "Landing Way · Main street, on the launch mount’s axis",
        },
        {
            at: 15,
            camera: [-62, 10, -15.5],
            target: [30, 16, -13],
            landmark: "Landing Square · The first landers, kept in place",
        },
        {
            at: 22,
            camera: [4, 23, -21],
            target: [77, 21.5, -15.5],
            landmark:
                "Harbour Gate · Blast doors, and a ship on the street’s axis",
        },
        {
            at: 29,
            camera: [5, 30, -30],
            target: [-16, 13, -112],
            landmark:
                "Biosphere · The city’s park, gene bank and reserve of air",
        },
        {
            at: 36,
            camera: [-140, 44, 100],
            target: [-20, 16, -20],
            landmark: "Ares · A grid city grown from its landing site",
        },
    ],
};

export function outpostCamera(
    T: typeof Three,
    group: Three.Group,
    world: "moon" | "mars",
    elapsed: number,
    launchAt?: (second: number) => Three.Vector3,
) {
    const tour = tours[world],
        time = elapsed % 36;
    const index = Math.max(
        0,
        tour.findIndex(
            (frame, i) =>
                i < tour.length - 1 &&
                time >= frame.at &&
                time < tour[i + 1].at,
        ),
    );
    const from = tour[index],
        to = tour[index + 1];
    const blend = T.MathUtils.smootherstep(time, from.at, to.at);
    group.updateWorldMatrix(true, false);
    const point = (a: number[], b: number[]) =>
        group.localToWorld(
            curveSurfacePoint(
                new T.Vector3()
                    .fromArray(a)
                    .lerp(new T.Vector3().fromArray(b), blend),
            ),
        );
    const result = {
        position: point(from.camera, to.camera),
        target: point(from.target, to.target),
        landmark: from.landmark,
    };
    if (world === "moon" && launchAt) {
        const launchView = (second: number) => {
            const position = launchAt(second);
            return {
                // Behind it and to the shaded side, looking up the track to
                // where it is going.
                position: group.localToWorld(
                    position.clone().add(new T.Vector3(-46, 14, 78)),
                ),
                target: group.localToWorld(
                    position.clone().add(new T.Vector3(0, 8, -22)),
                ),
            };
        };
        const departed = (second: number) =>
            group.localToWorld(launchAt(second).clone());
        if (time < 5) {
            const initial = tour[0];
            const chase = launchView(5),
                blend = T.MathUtils.smootherstep(time, 0, 5);
            result.position
                .copy(
                    group.localToWorld(
                        curveSurfacePoint(
                            new T.Vector3().fromArray(initial.camera),
                        ),
                    ),
                )
                .lerp(chase.position, blend);
            result.target
                .copy(
                    group.localToWorld(
                        curveSurfacePoint(
                            new T.Vector3().fromArray(initial.target),
                        ),
                    ),
                )
                .lerp(chase.target, blend);
        } else if (time < MUZZLE_FROM) {
            // Left behind short of the muzzle, the camera follows with its
            // eye only: a camera that kept pace would show nothing but sky.
            const chase = launchView(chaseClock(time));
            result.position.copy(chase.position);
            result.target.copy(chase.target).lerp(
                departed(time),
                // Part of the way: the muzzle stays in the picture.
                FOLLOWED *
                    T.MathUtils.smootherstep(
                        time,
                        CHASE_UNTIL,
                        CHASE_UNTIL + CHASE_SLOWING,
                    ),
            );
        } else if (time < MUZZLE_AT) {
            const held = launchView(chaseClock(MUZZLE_FROM));
            const chase = {
                    position: held.position,
                    target: held.target.lerp(departed(MUZZLE_FROM), FOLLOWED),
                },
                district = tour[4],
                blend = T.MathUtils.smootherstep(time, MUZZLE_FROM, MUZZLE_AT);
            result.position
                .copy(chase.position)
                .lerp(
                    group.localToWorld(
                        curveSurfacePoint(
                            new T.Vector3().fromArray(district.camera),
                        ),
                    ),
                    blend,
                );
            result.target
                .copy(chase.target)
                .lerp(
                    group.localToWorld(
                        curveSurfacePoint(
                            new T.Vector3().fromArray(district.target),
                        ),
                    ),
                    blend,
                );
        }
    }
    return result;
}

/** What a settlement is loaded with. */
export interface OutpostOptions {
    anisotropy: number;
    /** The lighter model and maps, for small screens and slow renderers. */
    lite: boolean;
}

/** The file a settlement's hardware is kept in. */
export const outpostModel = (world: "moon" | "mars", lite: boolean) =>
    `/models/${world}-outpost${lite ? "-lite" : ""}-v3.glb`;

/**
 * Loads a settlement: its hardware, built elsewhere and dressed here in the
 * site's finishes, and the ground it stands on. Everything is conformed to
 * the globe; what turns is kept rigid and set down where it stands.
 */
export async function loadOutpost(
    world: "moon" | "mars",
    renderer: Three.WebGLRenderer,
    { anisotropy, lite }: OutpostOptions,
) {
    const [
        T,
        { GLTFLoader },
        { DRACOLoader },
        grounds,
        finishes,
        floors,
        airs,
    ] = await Promise.all([
        import("three"),
        import("three/addons/loaders/GLTFLoader.js"),
        import("three/addons/loaders/DRACOLoader.js"),
        import("./settlement-ground"),
        import("./settlement-finishes"),
        import("./home-floor"),
        import("./settlement-air"),
    ]);
    const root = `/terrain/${world}-site-v1/${lite ? "half/" : ""}`;
    // Measurements, not pictures: no colour conversion, top row first.
    const measured = async (file: string) => {
        const response = await fetch(root + file);
        if (!response.ok)
            throw new Error(`${file} answered ${response.status}`);
        const bitmap = await createImageBitmap(await response.blob(), {
            premultiplyAlpha: "none",
            colorSpaceConversion: "none",
        });
        const texture = new T.Texture(bitmap);
        texture.flipY = false;
        texture.colorSpace = T.NoColorSpace;
        texture.minFilter = T.LinearMipmapLinearFilter;
        texture.anisotropy = anisotropy;
        texture.needsUpdate = true;
        texture.addEventListener("dispose", () => bitmap.close());
        return texture;
    };
    const decoder = new DRACOLoader()
        .setDecoderPath("/draco/")
        .setWorkerLimit(2);
    decoder.setDecoderConfig({ type: "js" });
    const [model, described, siteMap, reliefMap, soil] =
        await Promise.allSettled([
            new GLTFLoader()
                .setDRACOLoader(decoder)
                .loadAsync(outpostModel(world, lite)),
            fetch(`${root}site.json`).then((response) => {
                if (!response.ok)
                    throw new Error(`site.json answered ${response.status}`);
                return response.json() as Promise<SettlementSite>;
            }),
            measured("site.webp"),
            measured("relief.webp"),
            floors.loadFloor(
                world === "moon"
                    ? "/terrain/regolith-v1/"
                    : "/terrain/floor-v1/",
                !lite,
                anisotropy,
            ),
        ]);
    decoder.dispose();
    if (
        model.status === "rejected" ||
        described.status === "rejected" ||
        siteMap.status === "rejected" ||
        reliefMap.status === "rejected" ||
        soil.status === "rejected"
    ) {
        // Nothing half-loaded is kept.
        if (siteMap.status === "fulfilled") siteMap.value.dispose();
        if (reliefMap.status === "fulfilled") reliefMap.value.dispose();
        if (soil.status === "fulfilled") soil.value.dispose();
        if (model.status === "fulfilled") disposeOutpost(model.value.scene);
        throw [model, described, siteMap, reliefMap, soil].find(
            (each) => each.status === "rejected",
        )!.reason;
    }
    const site = described.value;
    const air = airs.makeSettlementAir(T, world);
    const environment = finishes.makeSettlementEnvironment(
        T,
        renderer,
        world,
        site.sun,
    );
    const dress = finishes.makeSettlementFinishes(
        T,
        world,
        site.labels,
        anisotropy,
        environment.texture,
        soil.value,
        air,
        radiusInMetres,
    );

    const source = model.value.scene;
    source.updateWorldMatrix(true, true);
    const group = new T.Group();
    group.name = `${world} settlement`;
    const found: Three.Mesh[] = [];
    source.traverse((object) => {
        if ((object as Three.Mesh).isMesh) found.push(object as Three.Mesh);
    });
    const meshes: Three.Mesh[] = [],
        spinners: Three.Group[] = [],
        movers = new Map<string, Three.Group>(),
        moving = new Map<Three.Object3D, Three.Group>();
    const placed = new T.Vector3(),
        turned = new T.Quaternion(),
        sized = new T.Vector3(),
        upright = new T.Vector3(),
        inverse = new T.Matrix4();
    // A part the site moves cannot bend to the globe as it goes: it stays
    // rigid about its own origin, seated where that origin lands and tilted
    // to the ground there.
    const seat = (node: Three.Object3D) => {
        let body = moving.get(node);
        if (body) return body;
        node.matrixWorld.decompose(placed, turned, sized);
        const holder = new T.Group();
        holder.name = `${node.name} seat`;
        holder.userData.uncurved = placed.toArray();
        holder.quaternion
            .setFromUnitVectors(
                new T.Vector3(0, 1, 0),
                surfaceUpright(placed, upright),
            )
            .multiply(turned);
        holder.position.copy(curveSurfacePoint(placed.clone()));
        body = new T.Group();
        body.name = node.name;
        holder.add(body);
        group.add(holder);
        moving.set(node, body);
        movers.set(node.name, body);
        if (node.name.startsWith("spin_")) spinners.push(body);
        return body;
    };
    // Largest footprint radius and height in model metres, for the horizon test.
    let reach = 0,
        height = 0;
    const point = new T.Vector3();
    for (const mesh of found) {
        const geometry = mesh.geometry;
        geometry.applyMatrix4(mesh.matrixWorld);
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        reach = Math.max(
            reach,
            Math.hypot(
                Math.max(Math.abs(box.min.x), Math.abs(box.max.x)),
                Math.max(Math.abs(box.min.z), Math.abs(box.max.z)),
            ),
        );
        height = Math.max(height, box.max.y);
        let mover: Three.Object3D | null = mesh.parent;
        while (mover && !MOVER.test(mover.name)) mover = mover.parent;
        let holder: Three.Object3D = group;
        if (mover) {
            holder = seat(mover);
            // Back into the part's own space: only its scale is kept.
            mover.matrixWorld.decompose(placed, turned, sized);
            geometry.applyMatrix4(
                inverse.compose(placed, turned, sized.setScalar(1)).invert(),
            );
        } else {
            const positions = geometry.getAttribute("position");
            for (let i = 0; i < positions.count; i++) {
                curveSurfacePoint(point.fromBufferAttribute(positions, i));
                positions.setXYZ(i, point.x, point.y, point.z);
            }
        }
        // The model's baked shading: sky, grime and wear at every vertex.
        const baked = geometry.getAttribute("color");
        if (baked) {
            geometry.setAttribute("surface", baked);
            geometry.deleteAttribute("color");
        } else {
            const open = new Float32Array(
                geometry.getAttribute("position").count * 3,
            );
            for (let i = 0; i < open.length; i += 3) open[i] = 1;
            geometry.setAttribute("surface", new T.BufferAttribute(open, 3));
        }
        geometry.computeBoundingSphere();
        geometry.computeBoundingBox();
        const named = Array.isArray(mesh.material)
            ? mesh.material[0]
            : mesh.material;
        const material = dress.finish(named.name.toLowerCase());
        for (const old of Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material])
            old.dispose();
        mesh.material = material;
        mesh.position.set(0, 0, 0);
        mesh.quaternion.identity();
        mesh.scale.setScalar(1);
        holder.add(mesh);
        mesh.castShadow = !material.transparent;
        mesh.receiveShadow = true;
        mesh.userData.casts = mesh.castShadow;
        meshes.push(mesh);
    }
    const soilMaps = {
        site: siteMap.value,
        relief: reliefMap.value,
        soil: soil.value,
    };
    const land = grounds.makeSettlementGround(
        T,
        world,
        site,
        soilMaps,
        curveSurfacePoint,
        !lite,
        air,
    );
    land.userData.casts = false;
    group.add(land);
    meshes.push(land);
    reach = Math.max(reach, grounds.SETTLEMENT_GROUND_EDGE[1]);
    // Margins cover rounding and the model-space bounding boxes.
    group.userData.settlement = {
        meshes,
        reach: reach * OUTPOST_SCALE * 1.1 + 0.02,
        height: height * OUTPOST_SCALE + 0.01,
        spinners,
        movers,
        drive: dress.drive,
    } satisfies SettlementParts;
    group.userData.orient = dress.orient;
    group.userData.air = air;
    group.userData.plan = {
        world,
        landmarks: site.landmarks ?? [],
        skyline: site.heights
            ? readSkyline(site.heights, site.metres)
            : undefined,
    } satisfies SettlementPlan;
    group.userData.textures = [
        siteMap.value,
        reliefMap.value,
        soil.value.relief,
        soil.value.colour,
        environment.texture,
        ...dress.textures,
    ];
    group.userData.release = () => {
        siteMap.value.dispose();
        reliefMap.value.dispose();
        soil.value.dispose();
        environment.dispose();
        air.dispose();
        dress.textures.forEach((texture) => texture.dispose());
    };
    // Named places with nothing drawn at them: the ends of the launch track
    // and of a transit run, a lander's nozzle.
    const marks: Three.Object3D[] = [];
    source.traverse((object) => {
        if (
            MOVER.test(object.name) &&
            !(object as Three.Mesh).isMesh &&
            !moving.has(object)
        )
            marks.push(object);
    });
    for (const mark of marks) {
        const place = mark.getWorldPosition(new T.Vector3());
        let mover: Three.Object3D | null = mark.parent;
        while (mover && !moving.has(mover)) mover = mover.parent;
        const anchor = new T.Object3D();
        anchor.name = mark.name;
        if (mover) {
            // It rides with the part it belongs to.
            mover.matrixWorld.decompose(placed, turned, sized);
            anchor.position.copy(
                place.applyMatrix4(
                    inverse
                        .compose(placed, turned, sized.setScalar(1))
                        .invert(),
                ),
            );
            moving.get(mover)!.add(anchor);
        } else {
            anchor.userData.uncurved = place.toArray();
            anchor.position.copy(curveSurfacePoint(place));
            group.add(anchor);
        }
    }
    return group;
}

/** Every texture the settlement draws with, each once. */
export function outpostTextures(group: Three.Object3D) {
    const textures = new Set<Three.Texture>(
        (group.userData.textures as Three.Texture[] | undefined) ?? [],
    );
    group.traverse((o) => {
        const mesh = o as Three.Mesh;
        if (!mesh.material) return;
        for (const material of Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material])
            for (const value of Object.values(material))
                if (value && typeof value === "object" && "isTexture" in value)
                    textures.add(value as Three.Texture);
    });
    return textures;
}

export function disposeOutpost(group: Three.Object3D) {
    const textures = new Set<Three.Texture>(),
        materials = new Set<Three.Material>();
    group.traverse((o) => {
        const mesh = o as Three.Mesh;
        mesh.geometry?.dispose();
        if (!mesh.material) return;
        for (const material of Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]) {
            materials.add(material);
            for (const value of Object.values(material))
                if (value && typeof value === "object" && "isTexture" in value)
                    textures.add(value as Three.Texture);
        }
    });
    textures.forEach((t) => t.dispose());
    materials.forEach((m) => m.dispose());
    (group.userData.release as (() => void) | undefined)?.();
}
