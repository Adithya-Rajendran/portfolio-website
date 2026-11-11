import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { makeSettlementFinishes } from "./settlement-finishes";

/** Stencilled on the hardware, in the order of its file's label sheet. */
export const WORKSHOP_LABELS = [
    "OWS 01",
    "HAB 02",
    "NODE 03",
    "LAB 04",
    "DOCK A",
    "ARM 1",
    "ARM 2",
    "DSV 01",
] as const;

/** Study units to a metre: the dock's keel truss spans the stage. */
export const WORKSHOP_SCALE = 0.088;

export const workshopModel = (lite: boolean) =>
    `/models/orbital-workshop${lite ? "-lite" : ""}-v1.glb`;

/** How far the arrays are turned from flat toward the page's sun. */
const WORKSHOP_ARRAY_TILT = 0.5;

/** Parts the file names so that they can be turned. */
const TURNS = /^(array_port|array_stbd|dish_az|dish_el)$/;

/**
 * The orbital dry dock: a keel truss, a dock with a vehicle half built in
 * it, the arms that build it and the modules its crew live in. It is made
 * with the same kit as the settlements and wears the same finishes, by the
 * material names its file carries.
 */
export async function loadOrbitalWorkshop(anisotropy: number, lite: boolean) {
    const decoder = new DRACOLoader().setDecoderPath("/draco/");
    decoder.setDecoderConfig({ type: "js" });
    let asset: T.Group;
    try {
        ({ scene: asset } = await new GLTFLoader()
            .setDRACOLoader(decoder)
            .loadAsync(workshopModel(lite)));
    } finally {
        decoder.dispose();
    }
    const dress = makeSettlementFinishes(
        T,
        "orbit",
        WORKSHOP_LABELS,
        anisotropy,
        undefined,
        undefined,
        undefined,
        0,
        WORKSHOP_LABELS.length,
    );
    const geometries: T.BufferGeometry[] = [],
        materials = new Set<T.Material>(),
        turns = new Map<string, T.Object3D>();
    asset.traverse((object) => {
        if (TURNS.test(object.name)) turns.set(object.name, object);
        if (!(object instanceof T.Mesh)) return;
        const geometry = object.geometry as T.BufferGeometry;
        geometries.push(geometry);
        // The model's baked shading: open sky, soot and wear at every vertex.
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
        const authored = (
            Array.isArray(object.material) ? object.material : [object.material]
        ) as T.Material[];
        const finish = dress.finish(authored[0].name.toLowerCase());
        authored.forEach((material) => material.dispose());
        object.material = finish;
        materials.add(finish);
        object.castShadow = !finish.transparent;
        object.receiveShadow = true;
    });
    asset.scale.setScalar(WORKSHOP_SCALE);
    const arrays = [turns.get("array_port"), turns.get("array_stbd")],
        azimuth = turns.get("dish_az"),
        elevation = turns.get("dish_el");
    const rest = {
        arrays: arrays.map((array) => array?.rotation.x ?? 0),
        azimuth: azimuth?.rotation.y ?? 0,
        elevation: elevation?.rotation.x ?? 0,
    };
    return {
        asset,
        geometries,
        materials: [...materials],
        textures: dress.textures,
        /** The arrays follow the sun and the dish its relay, slowly. */
        update(time: number) {
            arrays.forEach((array, index) => {
                if (array)
                    array.rotation.x =
                        rest.arrays[index] +
                        WORKSHOP_ARRAY_TILT +
                        Math.sin(time * 0.05 + index) * 0.1;
            });
            if (azimuth)
                azimuth.rotation.y = rest.azimuth + Math.sin(time * 0.04) * 0.5;
            if (elevation)
                elevation.rotation.x =
                    rest.elevation + Math.sin(time * 0.031 + 1) * 0.12;
        },
    };
}
