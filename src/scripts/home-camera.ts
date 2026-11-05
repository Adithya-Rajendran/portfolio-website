import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export interface HomeCameraPose {
    eye: T.Vector3;
    aim: T.Vector3;
}

/** One camera owner for deliberate exploration and interrupted guided moves. */
export function makeHomeCamera(
    camera: T.PerspectiveCamera,
    surface: HTMLElement,
    initialTarget: T.Vector3,
    floorAt: (x: number, z: number) => number,
    changed: () => void,
) {
    const initialEye = camera.position.clone();
    const orbit = new OrbitControls(camera, surface);
    orbit.target.copy(initialTarget);
    orbit.enabled = false;
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.12;
    orbit.rotateSpeed = 0.65;
    orbit.panSpeed = 0.7;
    orbit.zoomSpeed = 0.7;
    orbit.screenSpacePanning = false;
    orbit.minDistance = 7;
    orbit.maxDistance = 65;
    orbit.minPolarAngle = 0.15;
    // Include the shallow authored views so grabbing a guided move never
    // snaps its elevation. Terrain clearance handles low viewpoints.
    orbit.maxPolarAngle = 1.53;
    orbit.update();
    camera.position.copy(initialEye);
    camera.lookAt(initialTarget);
    let active = false;
    let instant = false;
    let flight:
        | {
              from: HomeCameraPose;
              to: HomeCameraPose;
              elapsed: number;
          }
        | undefined;
    const before = new T.Vector3();
    const previous = new T.Vector3();
    const targetMin = new T.Vector3(-40, 0.8, -92);
    const targetMax = new T.Vector3(30, 14, 18);

    const snapshot = (): HomeCameraPose => ({
        eye: camera.position.clone(),
        aim: orbit.target.clone(),
    });
    const clearInertia = () => {
        const pose = snapshot();
        orbit.enableDamping = false;
        orbit.update();
        camera.position.copy(pose.eye);
        orbit.target.copy(pose.aim);
        camera.lookAt(orbit.target);
        orbit.enableDamping = !instant;
    };
    const constrain = () => {
        before.copy(orbit.target);
        orbit.target.clamp(targetMin, targetMax);
        camera.position.add(before.sub(orbit.target).negate());
        camera.position.y = Math.max(
            camera.position.y,
            floorAt(camera.position.x, camera.position.z),
        );
        camera.lookAt(orbit.target);
    };
    const interrupt = () => {
        flight = undefined;
        clearInertia();
        changed();
    };
    const startInput = () => {
        interrupt();
        surface.focus({ preventScroll: true });
    };
    const goTo = (to: HomeCameraPose) => {
        clearInertia();
        if (instant) {
            camera.position.copy(to.eye);
            orbit.target.copy(to.aim);
            camera.lookAt(orbit.target);
            flight = undefined;
        } else {
            flight = { from: snapshot(), to, elapsed: 0 };
        }
        changed();
    };
    const zoom = (inward: boolean) => {
        interrupt();
        if (inward) orbit.dollyIn(1 / 1.16);
        else orbit.dollyOut(1 / 1.16);
        constrain();
        changed();
    };
    const key = (event: KeyboardEvent) => {
        if (!active || event.altKey || event.ctrlKey || event.metaKey) return;
        if (["+", "=", "-", "_"].includes(event.key)) {
            event.preventDefault();
            zoom(event.key === "+" || event.key === "=");
            return;
        }
        if (!event.key.startsWith("Arrow")) return;
        event.preventDefault();
        interrupt();
        const horizontal =
            event.key === "ArrowLeft" || event.key === "ArrowRight";
        const sign =
            event.key === "ArrowLeft" || event.key === "ArrowUp" ? 1 : -1;
        if (event.shiftKey)
            orbit.pan(horizontal ? sign * 32 : 0, horizontal ? 0 : sign * 32);
        else if (horizontal) orbit.rotateLeft(sign * 0.12);
        else orbit.rotateUp(sign * 0.09);
        constrain();
        changed();
    };
    orbit.addEventListener("start", startInput);
    orbit.addEventListener("change", changed);
    surface.addEventListener("keydown", key);

    return {
        get ownsCamera() {
            return active || Boolean(flight);
        },
        get active() {
            return active;
        },
        get transitioning() {
            return Boolean(flight);
        },
        get target() {
            return orbit.target;
        },
        setInstant(value: boolean) {
            instant = value;
            if (instant && flight) {
                // Pausing exploration freezes the present view. A completed
                // exit still returns to the page's authored composition.
                if (!active) {
                    camera.position.copy(flight.to.eye);
                    orbit.target.copy(flight.to.aim);
                    camera.lookAt(orbit.target);
                }
                flight = undefined;
            }
            orbit.enableDamping = !instant;
            if (instant) clearInertia();
        },
        activate(from: T.Vector3, to: HomeCameraPose) {
            orbit.target.copy(from);
            active = true;
            orbit.enabled = true;
            goTo(to);
        },
        deactivate(to: HomeCameraPose) {
            active = false;
            orbit.enabled = false;
            goTo(to);
        },
        goTo,
        zoom,
        update(delta: number) {
            previous.copy(camera.position);
            if (flight) {
                flight.elapsed += delta;
                const t = Math.min(1, flight.elapsed / 1.1);
                const ease = t * t * (3 - 2 * t);
                camera.position.lerpVectors(
                    flight.from.eye,
                    flight.to.eye,
                    ease,
                );
                orbit.target.lerpVectors(flight.from.aim, flight.to.aim, ease);
                camera.lookAt(orbit.target);
                if (active) constrain();
                if (t === 1) flight = undefined;
                changed();
            } else if (active) {
                orbit.dampingFactor =
                    1 - Math.exp(-Math.max(delta, 1 / 60) * 12);
                orbit.update(delta);
                constrain();
            }
            return previous.distanceToSquared(camera.position) > 0.0000001;
        },
        dispose() {
            orbit.removeEventListener("start", startInput);
            orbit.removeEventListener("change", changed);
            surface.removeEventListener("keydown", key);
            orbit.dispose();
        },
    };
}
