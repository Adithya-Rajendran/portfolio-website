import * as T from "three";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";

/** Static contact shading is reused while the dish, drone and scan animate. */
export function makeHomeOcclusion(
    renderer: T.WebGLRenderer,
    scene: T.Scene,
    camera: T.PerspectiveCamera,
) {
    const eye = camera.clone();
    const occlusion = new GTAOPass(scene, eye, 1, 1);
    occlusion.output = GTAOPass.OUTPUT.Off;
    occlusion.updateGtaoMaterial({
        radius: 0.55,
        thickness: 1,
        distanceExponent: 1.5,
        distanceFallOff: 0.8,
        scale: 1.1,
        samples: 8,
    });
    occlusion.updatePdMaterial({ radius: 4, samples: 8 });
    const world = new T.Matrix4(),
        projection = new T.Matrix4();
    let dirty = true,
        updates = 0,
        updated = -Infinity;
    const differs = (a: T.Matrix4, b: T.Matrix4) =>
        a.elements.some(
            (value, i) => Math.abs(value - b.elements[i]) > 0.00001,
        );
    return {
        texture: occlusion.gtaoMap,
        get updates() {
            return updates;
        },
        resize(width: number, height: number) {
            occlusion.setSize(
                Math.max(1, Math.round(width * 0.6)),
                Math.max(1, Math.round(height * 0.6)),
            );
            dirty = true;
        },
        /**
         * While the camera is easing and another frame is certain to follow,
         * `settling` refreshes the soft, low-resolution shade about twelve
         * times a second instead of on every display frame.
         */
        update(buffer: T.WebGLRenderTarget, settling = false) {
            camera.updateMatrixWorld();
            if (
                !dirty &&
                !differs(world, camera.matrixWorld) &&
                !differs(projection, camera.projectionMatrix)
            )
                return;
            const now = performance.now();
            if (settling && !dirty && now - updated < 80) return;
            updated = now;
            eye.copy(camera);
            eye.far = Math.min(camera.far, 90);
            eye.updateProjectionMatrix();
            const excluded: T.Object3D[] = [];
            scene.traverse((object) => {
                if (!(object instanceof T.Mesh) || !object.visible) return;
                const materials = Array.isArray(object.material)
                    ? object.material
                    : [object.material];
                if (
                    !object.userData.contactOcclusion ||
                    materials.every((material) => !material.depthWrite)
                ) {
                    excluded.push(object);
                    object.visible = false;
                }
            });
            const autoUpdate = renderer.shadowMap.autoUpdate;
            const needsUpdate = renderer.shadowMap.needsUpdate;
            const target = renderer.getRenderTarget();
            renderer.shadowMap.autoUpdate = false;
            renderer.shadowMap.needsUpdate = false;
            try {
                occlusion.render(renderer, buffer, buffer, 0, false);
                world.copy(camera.matrixWorld);
                projection.copy(camera.projectionMatrix);
                dirty = false;
                updates++;
            } finally {
                excluded.forEach((object) => {
                    object.visible = true;
                });
                renderer.shadowMap.autoUpdate = autoUpdate;
                renderer.shadowMap.needsUpdate = needsUpdate;
                renderer.setRenderTarget(target);
            }
        },
        dispose() {
            occlusion.dispose();
            occlusion.gtaoMaterial.dispose();
            occlusion.blendMaterial.dispose();
        },
    };
}
