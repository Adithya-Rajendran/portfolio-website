import * as T from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/** Subtle optical light spread, with one final tone/color conversion. */
export function makeHomeRendering(
    renderer: T.WebGLRenderer,
    scene: T.Scene,
    camera: T.Camera,
) {
    const target = new T.WebGLRenderTarget(1, 1, {
        type: T.HalfFloatType,
        samples: 4,
    });
    const composer = new EffectComposer(renderer, target);
    const scenePass = new RenderPass(scene, camera);
    const glow = new UnrealBloomPass(new T.Vector2(1, 1), 0.28, 0.38, 1.15);
    const output = new OutputPass();
    composer.addPass(scenePass);
    composer.addPass(glow);
    composer.addPass(output);
    return {
        render: () => composer.render(0),
        resize: (width: number, height: number) =>
            composer.setSize(width, height),
        dispose() {
            glow.dispose();
            output.dispose();
            composer.dispose();
        },
    };
}
