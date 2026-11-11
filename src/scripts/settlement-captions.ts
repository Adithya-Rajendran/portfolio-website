import type * as Three from "three";
import { curveSurfacePoint, settlementPlan } from "./planetary-outposts";
import { SETTLEMENTS } from "./settlement-places";
import { inSight, type Skyline } from "./settlement-skyline";

/** How far over a structure's top its name hangs, in metres. */
const LIFT = 5;
/** Names are chosen again this often, in milliseconds, so they do not flicker. */
const CHOOSE_EVERY = 240;

/**
 * Hangs the name of each structure over it while the view is on the ground.
 * The names repeat what the page lists in full, so the layer is hidden from
 * assistive technology and takes no pointer events.
 */
export function makeSettlementCaptions(T: typeof Three, host: HTMLElement) {
    const layer = document.createElement("div");
    layer.className = "observatory__captions";
    layer.setAttribute("aria-hidden", "true");
    host.appendChild(layer);

    type Caption = {
        tag: HTMLElement;
        /** Where it hangs, in the settlement's own curved metres. */
        at: Three.Vector3;
        /**
         * Half way from the top of what it names to the name itself, in the
         * settlement's metres as built: what a view has to be able to see.
         */
        top: [number, number, number];
        /** Its place in the list: earlier names are kept when crowded. */
        order: number;
        /** Room its text takes, in CSS pixels. */
        wide: number;
        shown: boolean;
        inView: boolean;
        x: number;
        y: number;
        /** Distance from the middle of the picture, 0 to about 1. */
        off: number;
        drawn: string;
    };
    let captions: Caption[] = [],
        named: Three.Object3D | undefined,
        skyline: Skyline | undefined,
        chosen = -Infinity;
    const point = new T.Vector3(),
        sized = new T.Vector3(),
        eye = new T.Vector3(),
        level = new T.Vector3();

    const name = (group: Three.Object3D) => {
        layer.replaceChildren();
        captions = [];
        named = group;
        const plan = settlementPlan(group);
        skyline = plan?.skyline;
        if (!plan) return;
        SETTLEMENTS[plan.world].places.forEach((place, order) => {
            for (const mark of plan.landmarks) {
                if (!place.at.includes(mark.name)) continue;
                const tag = document.createElement("span"),
                    text = document.createElement("b");
                text.textContent = place.name;
                tag.appendChild(text);
                layer.appendChild(tag);
                captions.push({
                    tag,
                    at: curveSurfacePoint(
                        new T.Vector3(mark.x, mark.y + LIFT, mark.z),
                    ),
                    top: [mark.x, mark.y + LIFT / 2, mark.z],
                    order,
                    wide: place.name.length * 7.3 + 16,
                    shown: false,
                    inView: false,
                    x: 0,
                    y: 0,
                    off: 0,
                    drawn: "",
                });
            }
        });
    };
    const show = (caption: Caption, shown: boolean) => {
        if (caption.shown === shown) return;
        caption.shown = shown;
        caption.tag.toggleAttribute("data-shown", shown);
    };

    return {
        /**
         * `group` is the settlement the view stands in, or nothing while it
         * is in orbit. `width` and `height` are the picture's, in CSS pixels.
         */
        update(
            camera: Three.Camera,
            group: Three.Object3D | undefined,
            width: number,
            height: number,
            now: number,
        ) {
            if (!group || height < 200) {
                for (const caption of captions) show(caption, false);
                return;
            }
            if (group !== named) name(group);
            const metre = group.getWorldScale(sized).x;
            for (const caption of captions) {
                point.copy(caption.at).applyMatrix4(group.matrixWorld);
                const far = point.distanceTo(camera.position) / metre;
                point.project(camera);
                caption.inView =
                    point.z > -1 &&
                    point.z < 1 &&
                    Math.abs(point.x) < 0.84 &&
                    point.y > -0.62 &&
                    point.y < 0.74 &&
                    far > 35 &&
                    far < 520;
                caption.off = Math.hypot(point.x, point.y);
                caption.x = (point.x * 0.5 + 0.5) * width;
                caption.y = (0.5 - point.y * 0.5) * height;
            }
            if (now - chosen > CHOOSE_EVERY) {
                chosen = now;
                const room = width < 560 ? 3 : width < 960 ? 5 : 7;
                // The camera, in the settlement's metres as built: the
                // ground's curve taken back out of its height.
                group.worldToLocal(eye.copy(camera.position));
                eye.y -= curveSurfacePoint(level.set(eye.x, 0, eye.z)).y;
                const from = [eye.x, eye.y, eye.z];
                // A name already up keeps its place over a slightly better
                // one, and each kind of structure is named once.
                // A name over a structure the view cannot see would read
                // as the name of whatever stands in front of it.
                const wanted = captions
                    .filter(
                        (caption) =>
                            caption.inView &&
                            (!skyline || inSight(skyline, from, caption.top)),
                    )
                    .sort(
                        (a, b) =>
                            a.order +
                            3 * a.off -
                            (a.shown ? 2.5 : 0) -
                            (b.order + 3 * b.off - (b.shown ? 2.5 : 0)),
                    );
                const kept: Caption[] = [];
                for (const caption of wanted) {
                    if (kept.length >= room) break;
                    if (
                        kept.some(
                            (other) =>
                                other.order === caption.order ||
                                (Math.abs(other.x - caption.x) <
                                    (other.wide + caption.wide) / 2 + 10 &&
                                    Math.abs(other.y - caption.y) < 44),
                        )
                    )
                        continue;
                    kept.push(caption);
                }
                for (const caption of captions)
                    show(caption, kept.includes(caption));
            }
            for (const caption of captions) {
                if (!caption.shown) continue;
                const drawn = `translate3d(${caption.x.toFixed(1)}px,${caption.y.toFixed(1)}px,0)`;
                if (drawn === caption.drawn) continue;
                caption.drawn = drawn;
                caption.tag.style.transform = drawn;
            }
        },
        dispose() {
            layer.remove();
            captions = [];
            named = undefined;
        },
    };
}
