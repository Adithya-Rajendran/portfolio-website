import * as T from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { makeHomeOcclusion } from "./home-occlusion";

/** Subtle optical light spread, with one final tone/color conversion. */
export function makeHomeRendering(
    renderer: T.WebGLRenderer,
    scene: T.Scene,
    camera: T.PerspectiveCamera,
) {
    const target = new T.WebGLRenderTarget(1, 1, {
        type: T.HalfFloatType,
        samples: 4,
    });
    const composer = new EffectComposer(renderer, target);
    const scenePass = new RenderPass(scene, camera);
    const contact = makeHomeOcclusion(renderer, scene, camera);
    const shadeMaterial = new T.ShaderMaterial({
        uniforms: {
            tDiffuse: { value: null },
            contact: { value: contact.texture },
        },
        vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
        fragmentShader: `uniform sampler2D tDiffuse,contact;varying vec2 vUv;
            void main(){vec4 source=texture2D(tDiffuse,vUv);float ao=texture2D(contact,vUv).r;
                gl_FragColor=vec4(source.rgb*mix(1.,max(ao,.35),.48),source.a);}`,
        depthTest: false,
        depthWrite: false,
    });
    const shade = new ShaderPass(shadeMaterial);
    const glow = new UnrealBloomPass(new T.Vector2(1, 1), 0.2, 0.45, 1.35);
    const output = new OutputPass();
    composer.addPass(scenePass);
    composer.addPass(shade);
    composer.addPass(glow);
    composer.addPass(output);
    return {
        get occlusionUpdates() {
            return contact.updates;
        },
        render() {
            contact.update(composer.readBuffer);
            composer.render(0);
        },
        resize(width: number, height: number) {
            composer.setPixelRatio(renderer.getPixelRatio());
            composer.setSize(width, height);
            contact.resize(width, height);
            // Light spread needs no more than CSS resolution, even on Retina.
            // Keep the scene/color target at the renderer's full resolution.
            glow.setSize(width, height);
        },
        dispose() {
            contact.dispose();
            shade.dispose();
            glow.dispose();
            output.dispose();
            composer.dispose();
        },
    };
}
