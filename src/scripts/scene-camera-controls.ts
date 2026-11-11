import type { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function bindCameraTools(
    host: HTMLElement,
    actions: {
        toggle: () => void;
        reset: () => void;
        zoom: (inward: boolean) => void;
    },
) {
    const tools = host.querySelector<HTMLElement>("[data-scene-camera-tools]");
    const buttons = tools?.querySelector<HTMLElement>(
        "[data-scene-camera-actions]",
    );
    const toggle = tools?.querySelector<HTMLButtonElement>(
        "[data-scene-camera-toggle]",
    );
    const help = host.querySelector<HTMLElement>("[data-scene-camera-help]");
    if (!tools || !buttons || !toggle || !help) return;

    const listeners = new AbortController();
    const { signal } = listeners;
    toggle.addEventListener("click", actions.toggle, { signal });
    buttons
        .querySelector("[data-scene-camera-reset]")
        ?.addEventListener("click", actions.reset, { signal });
    for (const button of buttons.querySelectorAll<HTMLButtonElement>(
        "[data-scene-camera-zoom]",
    ))
        button.addEventListener(
            "click",
            () => actions.zoom(button.dataset.sceneCameraZoom === "in"),
            { signal },
        );

    const setActive = (active: boolean) => {
        buttons.hidden = !active;
        help.hidden = !active;
        toggle.textContent = active ? "Done" : "Explore scene";
        toggle.setAttribute("aria-expanded", String(active));
    };
    return {
        show() {
            tools.hidden = false;
        },
        focusToggle() {
            toggle.focus({ preventScroll: true });
        },
        setActive,
        dispose() {
            listeners.abort();
            setActive(false);
            tools.hidden = true;
        },
    };
}

export function configureSceneOrbit(orbit: OrbitControls) {
    orbit.rotateSpeed = 0.65;
    orbit.panSpeed = 0.7;
    orbit.zoomSpeed = 0.7;
    orbit.screenSpacePanning = false;
}

export function zoomSceneCamera(orbit: OrbitControls, inward: boolean) {
    if (inward) orbit.dollyIn(1 / 1.16);
    else orbit.dollyOut(1 / 1.16);
}

export function isCameraShortcut(event: KeyboardEvent) {
    return (
        !event.defaultPrevented &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey
    );
}

export function applySceneCameraKey(
    event: KeyboardEvent,
    orbit: OrbitControls,
    prepare: () => void,
) {
    if (!isCameraShortcut(event)) return false;
    const { key } = event;
    const zoomIn = key === "+" || key === "=";
    if (zoomIn || key === "-" || key === "_") {
        event.preventDefault();
        prepare();
        zoomSceneCamera(orbit, zoomIn);
        return true;
    }
    const horizontal = key === "ArrowLeft" || key === "ArrowRight";
    if (!horizontal && key !== "ArrowUp" && key !== "ArrowDown") return false;
    event.preventDefault();
    prepare();
    const sign = key === "ArrowLeft" || key === "ArrowUp" ? 1 : -1;
    if (event.shiftKey && orbit.enablePan)
        orbit.pan(horizontal ? sign * 32 : 0, horizontal ? 0 : sign * 32);
    else if (horizontal) orbit.rotateLeft(sign * 0.12);
    else orbit.rotateUp(sign * 0.09);
    return true;
}
