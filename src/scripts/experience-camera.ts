import type * as Three from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";

export const TERRAIN_RADIUS = 1.011;

export interface CameraPose {
    position: Three.Vector3;
    target: Three.Vector3;
    up: Three.Vector3;
}

/** Spherical interpolation never cuts through a planet, even from its far side. */
export function arcPosition(
    T: typeof Three,
    from: Three.Vector3,
    to: Three.Vector3,
    center: Three.Vector3,
    amount: number,
) {
    const a = from.clone().sub(center);
    const b = to.clone().sub(center);
    const radius = Math.exp(
        T.MathUtils.lerp(
            Math.log(Math.max(0.001, a.length())),
            Math.log(Math.max(0.001, b.length())),
            amount,
        ),
    );
    a.normalize();
    b.normalize();
    const rotation = new T.Quaternion().setFromUnitVectors(a, b);
    return a
        .applyQuaternion(new T.Quaternion().slerp(rotation, amount))
        .multiplyScalar(radius)
        .add(center);
}

/**
 * Only this rig writes the rendered camera. OrbitControls operates a separate
 * camera in a fixed Y-up frame; guided poses never pass through its zoom clamps
 * or its cached up-axis transform.
 */
export function createExperienceCamera(
    T: typeof Three,
    camera: Three.PerspectiveCamera,
    orbit: OrbitControls,
) {
    const target = new T.Vector3();
    const control = orbit.object;
    const controlFrame = new T.Quaternion();
    const inverseFrame = new T.Quaternion();
    const look = new T.PerspectiveCamera();
    const yAxis = new T.Vector3(0, 1, 0);
    // Clear the authored terrain ridges as well as the mathematical globe.
    // Settlements use scale .00065 and a tangent-frame base radius of 1.0016.
    const minimumRadius = TERRAIN_RADIUS + 0.001;
    let initialized = false;

    function beginManual(surface: boolean) {
        // Flush residual damping before replacing the input pose, never after.
        orbit.enableDamping = false;
        orbit.minDistance = 0.001;
        orbit.maxPolarAngle = Math.PI;
        orbit.update(0);
        // Preserve the view the visitor actually sees, including an interrupted
        // turn whose orientation has not yet caught up with its guided focus.
        const focusDistance = camera.position.distanceTo(target);
        camera
            .getWorldDirection(target)
            .multiplyScalar(focusDistance)
            .add(camera.position);
        controlFrame.setFromUnitVectors(yAxis, camera.up);
        inverseFrame.copy(controlFrame).invert();
        control.position.copy(camera.position).applyQuaternion(inverseFrame);
        orbit.target.copy(target).applyQuaternion(inverseFrame);
        orbit.minDistance = surface ? 0.0143 : Math.min(2.2, focusDistance);
        // Keep the local horizon upright. Collision clearance is also enforced
        // after interpolation, before calculating the rendered orientation.
        orbit.minPolarAngle = 0.025;
        const initialPolar = new T.Spherical().setFromVector3(
            control.position.clone().sub(orbit.target),
        ).phi;
        orbit.maxPolarAngle = surface
            ? Math.max(initialPolar, Math.PI / 2 - 0.035)
            : Math.PI - 0.025;
        orbit.update(0);
    }

    function manualPose(): CameraPose {
        return {
            position: control.position.clone().applyQuaternion(controlFrame),
            target: orbit.target.clone().applyQuaternion(controlFrame),
            up: yAxis.clone().applyQuaternion(controlFrame),
        };
    }

    function move(
        pose: CameraPose,
        delta: number,
        options: {
            instant: boolean;
            manual: boolean;
            center?: Three.Vector3;
            globes: Three.Group[];
        },
    ) {
        const instant = options.instant || !initialized;
        const step = Math.min(0.1, Math.max(0, delta));
        const blend = instant
            ? 1
            : 1 - Math.exp(-step * (options.manual ? 24 : 6));
        const previousPosition = camera.position.clone();
        if (options.center && !instant)
            camera.position.copy(
                arcPosition(
                    T,
                    camera.position,
                    pose.position,
                    options.center,
                    blend,
                ),
            );
        else camera.position.lerp(pose.position, blend);
        if (camera.position.distanceToSquared(pose.position) < 1e-12)
            camera.position.copy(pose.position);
        const distance = previousPosition.distanceTo(camera.position);
        if (!instant && !options.manual && distance > step * 7)
            camera.position.lerpVectors(
                previousPosition,
                camera.position,
                (step * 7) / distance,
            );

        for (const globe of options.globes) {
            const offset = camera.position.clone().sub(globe.position);
            if (offset.length() < minimumRadius) {
                if (offset.lengthSq() < 1e-12) offset.copy(yAxis);
                camera.position
                    .copy(globe.position)
                    .add(offset.setLength(minimumRadius));
            }
        }
        const targetDistance = target.distanceTo(pose.target);
        const targetBlend =
            instant || options.manual
                ? blend
                : Math.min(blend, (step * 7) / Math.max(targetDistance, 1e-6));
        target.lerp(pose.target, targetBlend);
        if (target.distanceToSquared(pose.target) < 1e-12)
            target.copy(pose.target);
        camera.up.lerp(pose.up, blend).normalize();
        look.position.copy(camera.position);
        look.up.copy(camera.up);
        look.lookAt(target);
        // Bounded rotation prevents a reversal or a very long frame producing
        // a whip-pan. Focus is bounded independently, rather than reconstructed
        // from a lagging rotation and a changing radius on every frame.
        const angle = camera.quaternion.angleTo(look.quaternion);
        const rotationBlend = instant
            ? 1
            : Math.min(blend, (step * Math.PI) / 2 / Math.max(angle, 1e-6));
        camera.quaternion.slerp(look.quaternion, rotationBlend);
        if (angle < 1e-6) camera.quaternion.copy(look.quaternion);
        initialized = true;
    }

    return { target, beginManual, manualPose, move };
}
