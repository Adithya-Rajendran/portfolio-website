import type * as Three from "three";
import { curveSurfacePoint, settlementParts } from "./planetary-outposts";

/** Traffic keeps the tour's clock, so each shot of it finds the same scene. */
const CYCLE = 36;
/** A lander leaves its berth, is gone, and comes back to it, in seconds. */
const LIFT_OFF = 3,
    CLIMB = 9,
    APPROACH = 26.5,
    TOUCH_DOWN = 35;
/** How high it is when it passes out of the picture, in model metres. */
const CEILING = 190;
/** A pod runs out, waits, and runs back; twice in a tour. */
const POD = { run: 6.5, wait: 2.5 };

const EXHAUST = { moon: 0xbfd9ff, mars: 0xffb07a } as const;

/**
 * What moves in a settlement besides its launch track: the lander that works
 * its berth (`fly_lander`, with its nozzle at `fly_lander_engine`) and the
 * pod on the transit run (`ride_pod` between `ride_a` and `ride_b`). A model
 * without these parts gets nothing.
 */
export function addSettlementTraffic(
    T: typeof Three,
    outpost: Three.Group,
    world: "moon" | "mars",
) {
    const parts = settlementParts(outpost);
    const lander = parts?.movers.get("fly_lander"),
        pod = parts?.movers.get("ride_pod"),
        podFrom = outpost.getObjectByName("ride_a"),
        podTo = outpost.getObjectByName("ride_b");

    let plume: Three.Mesh | undefined;
    const plumeMaterial = new T.MeshBasicMaterial({
        color: EXHAUST[world],
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        blending: T.AdditiveBlending,
        side: T.DoubleSide,
    });
    if (lander) {
        // The exhaust: a cone below the nozzle, brightest where it leaves.
        // In a vacuum it spreads wide and thin; in Mars's air it holds.
        const spread = world === "moon" ? 2.6 : 1.3;
        const geometry = new T.CylinderGeometry(
            0.5,
            spread,
            1,
            14,
            4,
            true,
        ).translate(0, -0.5, 0);
        const places = geometry.getAttribute("position"),
            shades = new Float32Array(places.count * 3);
        for (let i = 0; i < places.count; i++)
            shades.fill(
                Math.max(0, 1 + places.getY(i)) ** 2.2,
                i * 3,
                i * 3 + 3,
            );
        geometry.setAttribute("color", new T.BufferAttribute(shades, 3));
        plume = new T.Mesh(geometry, plumeMaterial);
        plume.frustumCulled = false;
        plume.visible = false;
        plume.renderOrder = outpost.renderOrder + 1;
        const nozzle = lander.getObjectByName("fly_lander_engine");
        if (nozzle) plume.position.copy(nozzle.position);
        lander.add(plume);
    }

    const from = new T.Vector3(),
        to = new T.Vector3(),
        place = new T.Vector3();
    const run =
        pod && podFrom?.userData.uncurved && podTo?.userData.uncurved
            ? () => {
                  from.fromArray(podFrom.userData.uncurved as number[]);
                  to.fromArray(podTo.userData.uncurved as number[]);
              }
            : undefined;

    return {
        update(elapsed: number) {
            const time = elapsed % CYCLE;
            if (lander) {
                // Up on a steady burn; down on a harder one that ends at
                // the pad, the way a lander with no air to help it must.
                let altitude = 0,
                    thrust = 0;
                if (time >= LIFT_OFF && time < LIFT_OFF + CLIMB) {
                    const since = (time - LIFT_OFF) / CLIMB;
                    altitude = CEILING * since * since;
                    thrust = 1;
                } else if (time >= LIFT_OFF + CLIMB && time < APPROACH)
                    altitude = Infinity;
                else if (time >= APPROACH && time < TOUCH_DOWN) {
                    const left =
                        1 - (time - APPROACH) / (TOUCH_DOWN - APPROACH);
                    altitude = CEILING * left * left;
                    thrust = 0.75 + 0.25 * (1 - left);
                }
                lander.visible = Number.isFinite(altitude);
                lander.position.y = lander.visible ? altitude : 0;
                if (plume) {
                    plume.visible = thrust > 0;
                    // A flame is never still.
                    const flicker =
                        0.88 +
                        0.12 * Math.sin(elapsed * 61) * Math.sin(elapsed * 37);
                    plume.scale.set(
                        1,
                        (world === "moon" ? 7 : 11) * thrust * flicker,
                        1,
                    );
                    plumeMaterial.opacity = 0.8 * thrust * flicker;
                }
            }
            if (pod && run) {
                run();
                const lap = 2 * (POD.run + POD.wait),
                    turn = time % lap;
                const out = T.MathUtils.smootherstep(
                        turn,
                        POD.wait,
                        POD.wait + POD.run,
                    ),
                    back = T.MathUtils.smootherstep(
                        turn,
                        2 * POD.wait + POD.run,
                        lap,
                    );
                // The pod's seat is what was stood on the line; it slides.
                pod.parent!.position.copy(
                    curveSurfacePoint(place.copy(from).lerp(to, out - back)),
                );
            }
        },
    };
}
