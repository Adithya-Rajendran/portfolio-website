import { Spherical, Vector3 } from "three";
import type { PerspectiveCamera } from "three";

/** In-page inspection: horizontal touch drags orbit; vertical swipes stay native. */
export function makeInlineOrbit({
    element,
    camera,
    target,
    wake,
    minPolar = 0.25,
    maxPolar = Math.PI - 0.25,
    maxYaw = Math.PI,
    onInteract,
}: {
    element: HTMLElement;
    camera: PerspectiveCamera;
    target: Vector3;
    wake: () => void;
    minPolar?: number;
    maxPolar?: number;
    maxYaw?: number;
    onInteract?: () => void;
}) {
    const home = new Spherical().setFromVector3(
        camera.position.clone().sub(target),
    );
    const spherical = new Spherical();
    const offset = new Vector3();
    const current = { yaw: 0, pitch: 0, zoom: 1 };
    const desired = { ...current };
    let gesture:
        | { id: number; x: number; y: number; touch: boolean; started: boolean }
        | undefined;
    const clamp = () => {
        desired.yaw = Math.max(-maxYaw, Math.min(maxYaw, desired.yaw));
        desired.pitch = Math.max(
            minPolar - home.phi,
            Math.min(maxPolar - home.phi, desired.pitch),
        );
        desired.zoom = Math.max(0.76, Math.min(1.5, desired.zoom));
        wake();
    };
    const end = () => {
        const id = gesture?.id;
        gesture = undefined;
        if (id !== undefined && element.hasPointerCapture(id))
            element.releasePointerCapture(id);
        delete element.dataset.dragging;
    };
    const down = (event: PointerEvent) => {
        if (!event.isPrimary) {
            end();
            return;
        }
        if (event.button !== 0) return;
        gesture = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            touch: event.pointerType === "touch",
            started: event.pointerType !== "touch",
        };
        if (!gesture.touch) {
            event.preventDefault();
            element.focus({ preventScroll: true });
            element.setPointerCapture(event.pointerId);
            element.dataset.dragging = "true";
        }
    };
    const move = (event: PointerEvent) => {
        if (!gesture || event.pointerId !== gesture.id) return;
        const dx = event.clientX - gesture.x;
        const dy = event.clientY - gesture.y;
        if (!gesture.started) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
            if (Math.abs(dy) >= Math.abs(dx)) {
                end();
                return;
            }
            gesture.started = true;
            element.setPointerCapture(event.pointerId);
            element.dataset.dragging = "true";
        }
        const span = Math.max(
            200,
            Math.min(element.clientWidth, element.clientHeight),
        );
        desired.yaw -= (dx / span) * Math.PI;
        // One-finger vertical gestures belong to the document, including pinch zoom.
        if (!gesture.touch) desired.pitch -= (dy / span) * Math.PI;
        gesture.x = event.clientX;
        gesture.y = event.clientY;
        onInteract?.();
        clamp();
    };
    const up = (event: PointerEvent) => {
        // Touch starts with implicit capture on the canvas. Moving capture to
        // the stage emits a bubbling loss from that child, not from our drag.
        if (event.type === "lostpointercapture" && event.target !== element)
            return;
        if (event.pointerId === gesture?.id) end();
    };
    const reset = () => {
        Object.assign(desired, { yaw: 0, pitch: 0, zoom: 1 });
        onInteract?.();
        wake();
    };
    const zoom = (closer: boolean) => {
        desired.zoom *= closer ? 0.9 : 1 / 0.9;
        onInteract?.();
        clamp();
    };
    const key = (event: KeyboardEvent) => {
        if (
            event.target !== element ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey
        )
            return;
        const step = event.shiftKey ? 0.35 : 0.12;
        switch (event.key) {
            case "ArrowLeft":
                desired.yaw -= step;
                break;
            case "ArrowRight":
                desired.yaw += step;
                break;
            case "ArrowUp":
                desired.pitch -= step;
                break;
            case "ArrowDown":
                desired.pitch += step;
                break;
            case "+":
            case "=":
                zoom(true);
                break;
            case "-":
                zoom(false);
                break;
            case "Home":
                reset();
                break;
            default:
                return;
        }
        event.preventDefault();
        onInteract?.();
        clamp();
    };
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", up);
    element.addEventListener("lostpointercapture", up);
    element.addEventListener("keydown", key);
    element.tabIndex = 0;
    element.setAttribute("role", "region");
    element.setAttribute("aria-roledescription", "3D scene");
    return {
        reset,
        zoom,
        setHome(position: Vector3) {
            home.setFromVector3(offset.copy(position).sub(target));
            clamp();
        },
        update(delta: number, immediate = false) {
            const ease = immediate
                ? 1
                : 1 - Math.exp(-Math.max(delta, 1 / 120) * 14);
            let moving = false;
            for (const axis of ["yaw", "pitch", "zoom"] as const) {
                current[axis] += (desired[axis] - current[axis]) * ease;
                if (Math.abs(desired[axis] - current[axis]) < 0.0001)
                    current[axis] = desired[axis];
                else moving = true;
            }
            spherical.set(
                home.radius * current.zoom,
                Math.max(
                    minPolar,
                    Math.min(maxPolar, home.phi + current.pitch),
                ),
                home.theta + current.yaw,
            );
            camera.position
                .copy(offset.setFromSpherical(spherical))
                .add(target);
            camera.lookAt(target);
            element.dataset.viewYaw = current.yaw.toFixed(3);
            element.dataset.viewPitch = current.pitch.toFixed(3);
            element.dataset.viewZoom = current.zoom.toFixed(3);
            return moving;
        },
        dispose() {
            end();
            element.removeEventListener("pointerdown", down);
            element.removeEventListener("pointermove", move);
            element.removeEventListener("pointerup", up);
            element.removeEventListener("pointercancel", up);
            element.removeEventListener("lostpointercapture", up);
            element.removeEventListener("keydown", key);
            element.removeAttribute("tabindex");
            element.setAttribute("role", "img");
            element.removeAttribute("aria-roledescription");
        },
    };
}
