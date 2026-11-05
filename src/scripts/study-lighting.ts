import * as T from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";

/** A high-dynamic-range light stage: broad reflections describe curved metal. */
export function makeStudyEnvironment(
    renderer: T.WebGLRenderer,
    scene: T.Scene,
) {
    const stage = new T.Scene();
    stage.background = new T.Color(0.009, 0.014, 0.023);
    const geometry = new T.PlaneGeometry(1, 1);
    const materials: T.MeshBasicMaterial[] = [];
    const panel = (position: number[], size: number[], color: number[]) => {
        const material = new T.MeshBasicMaterial({
            color: new T.Color().fromArray(color),
            side: T.DoubleSide,
            toneMapped: false,
        });
        materials.push(material);
        const light = new T.Mesh(geometry, material);
        light.position.fromArray(position);
        light.scale.set(size[0], size[1], 1);
        light.lookAt(0, 0, 0);
        stage.add(light);
    };
    panel([-5, 6, 7], [8, 4], [12, 8.5, 4.8]);
    panel([6, 1, 4], [2.3, 9], [3.8, 5.8, 8]);
    panel([-1, 2, 10], [1.5, 6], [7, 6, 4.5]);
    panel([2, 5, -6], [8, 5], [2.8, 4.5, 6.5]);
    panel([0, -7, 1], [12, 8], [0.65, 0.36, 0.17]);
    const generator = new T.PMREMGenerator(renderer);
    const map = generator.fromScene(stage, 0.035, 0.1, 60, { size: 256 });
    geometry.dispose();
    materials.forEach((material) => material.dispose());
    let disposed = false;
    let generatorDisposed = false;
    const disposeGenerator = () => {
        if (generatorDisposed) return;
        generatorDisposed = true;
        generator.dispose();
    };
    let captured: T.WebGLRenderTarget | undefined;
    const ready = new HDRLoader()
        .loadAsync("/lighting/studio-small-09-v1.hdr")
        .then((hdr) => {
            if (disposed) {
                hdr.dispose();
                return;
            }
            try {
                hdr.mapping = T.EquirectangularReflectionMapping;
                captured = generator.fromEquirectangular(hdr);
                scene.environment = captured.texture;
                scene.environmentRotation.set(0, 0.8, 0);
            } finally {
                hdr.dispose();
            }
        })
        .catch(() => {
            // The authored reflection stage remains complete when offline.
        })
        .finally(disposeGenerator);
    return {
        texture: map.texture,
        ready,
        dispose() {
            disposed = true;
            disposeGenerator();
            map.dispose();
            captured?.dispose();
        },
    };
}
