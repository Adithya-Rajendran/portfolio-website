import type * as Three from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";

export const TERRAIN_RADIUS = 1.011;

export interface CameraPose {
    position: Three.Vector3;
    target: Three.Vector3;
    up: Three.Vector3;
}

/**
 * The ground a settlement draws for itself: level, with none of the globe's
 * ridges, out to `reach` from `at`. Over it the camera may come down to
 * `radius` from the centre of the globe at `globe`; the ridges' own
 * clearance is back in force by `beyond`. All in the scene's units.
 */
export interface DrawnGround {
    globe: Three.Vector3;
    at: Three.Vector3;
    reach: number;
    beyond: number;
    radius: number;
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
    const manual: CameraPose = {
        position: new T.Vector3(),
        target: new T.Vector3(),
        up: new T.Vector3(),
    };
    // Reused by move(), which runs every frame.
    const previousPosition = new T.Vector3();
    const offset = new T.Vector3();
    // Clear the authored terrain ridges as well as the mathematical globe.
    // Settlements use scale .00065 and a tangent-frame base radius of 1.0016.
    const minimumRadius = TERRAIN_RADIUS + 0.001;
    let initialized = false;

    function setManualPose(pose: CameraPose, surface: boolean) {
        // Flush residual damping before replacing the input pose, never after.
        orbit.enableDamping = false;
        orbit.update(0);
        const distance = pose.position.distanceTo(pose.target);
        controlFrame.setFromUnitVectors(yAxis, pose.up);
        inverseFrame.copy(controlFrame).invert();
        control.position.copy(pose.position).applyQuaternion(inverseFrame);
        orbit.target.copy(pose.target).applyQuaternion(inverseFrame);
        orbit.cursor.copy(orbit.target);
        orbit.maxTargetRadius = surface ? 0.2 : 3.5;
        orbit.minDistance = Math.min(surface ? 0.0143 : 2.2, distance);
        orbit.maxDistance = Math.max(14, distance);
        // Keep the incoming elevation reachable and the local horizon upright.
        const polar = offset
            .copy(control.position)
            .sub(orbit.target)
            .angleTo(yAxis);
        orbit.minPolarAngle = Math.min(polar, 0.025);
        orbit.maxPolarAngle = Math.max(
            polar,
            surface ? Math.PI / 2 - 0.035 : Math.PI - 0.025,
        );
        orbit.update(0);
    }

    function beginManual(surface: boolean) {
        // Preserve the view the visitor actually sees, including an interrupted
        // turn whose orientation has not yet caught up with its guided focus.
        const focusDistance = camera.position.distanceTo(target);
        manual.position.copy(camera.position);
        manual.up.copy(camera.up);
        camera
            .getWorldDirection(manual.target)
            .multiplyScalar(focusDistance)
            .add(camera.position);
        target.copy(manual.target);
        setManualPose(manual, surface);
    }

    function manualPose(): CameraPose {
        manual.position.copy(control.position).applyQuaternion(controlFrame);
        manual.target.copy(orbit.target).applyQuaternion(controlFrame);
        manual.up.copy(yAxis).applyQuaternion(controlFrame);
        return manual;
    }

    function move(
        pose: CameraPose,
        delta: number,
        options: {
            instant: boolean;
            manual: boolean;
            center?: Three.Vector3;
            globes: Three.Group[];
            ground?: DrawnGround;
        },
    ) {
        const instant = options.instant || !initialized;
        const step = Math.min(0.1, Math.max(0, delta));
        const blend = instant
            ? 1
            : 1 - Math.exp(-step * (options.manual ? 24 : 6));
        previousPosition.copy(camera.position);
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

        const ground = options.ground;
        for (const globe of options.globes) {
            offset.copy(camera.position).sub(globe.position);
            // Street level in a settlement is far below the globe's ridges.
            const floor =
                ground && globe.position.distanceToSquared(ground.globe) < 1e-12
                    ? T.MathUtils.lerp(
                          ground.radius,
                          minimumRadius,
                          T.MathUtils.smoothstep(
                              camera.position.distanceTo(ground.at),
                              ground.reach,
                              ground.beyond,
                          ),
                      )
                    : minimumRadius;
            if (offset.length() < floor) {
                if (offset.lengthSq() < 1e-12) offset.copy(yAxis);
                camera.position
                    .copy(globe.position)
                    .add(offset.setLength(floor));
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

    return { target, beginManual, setManualPose, manualPose, move };
}
