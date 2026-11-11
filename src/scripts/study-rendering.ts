import * as T from "three";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";

/** Antialiased HDR color and local contact shading, preserving the shared sky. */
export function makeStudyRendering(
    renderer: T.WebGLRenderer,
    scene: T.Scene,
    planets: T.Scene,
    camera: T.PerspectiveCamera,
) {
    const originalShadowAutoUpdate = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    const color = new T.WebGLRenderTarget(1, 1, {
        type: T.HalfFloatType,
        samples: 4,
    });
    const occlusion = new GTAOPass(scene, camera, 1, 1);
    occlusion.output = GTAOPass.OUTPUT.Off;
    occlusion.updateGtaoMaterial({
        radius: 0.42,
        thickness: 0.75,
        distanceExponent: 1.5,
        distanceFallOff: 0.85,
        scale: 1.5,
        samples: 12,
    });
    occlusion.updatePdMaterial({ radius: 5, samples: 12 });
    const composite = new T.ShaderMaterial({
        uniforms: {
            color: { value: color.texture },
            ao: { value: occlusion.gtaoMap },
        },
        vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
        fragmentShader: `uniform sampler2D color,ao;varying vec2 vUv;
            void main(){vec4 source=texture2D(color,vUv);float shade=texture2D(ao,vUv).r;
                gl_FragColor=vec4(source.rgb*mix(1.,max(shade,.25),.65),source.a);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }`,
        depthTest: false,
        depthWrite: false,
        blending: T.NoBlending,
    });
    const quad = new FullScreenQuad(composite);
    // Reused every frame; the scene graph is walked, not reallocated.
    const excluded: T.Object3D[] = [];
    const hideDepthless = (object: T.Object3D) => {
        if (!(object instanceof T.Mesh) || !object.visible) return;
        const material = object.material as T.Material | T.Material[];
        if (Array.isArray(material)) {
            for (const entry of material) if (entry.depthWrite) return;
        } else if (material.depthWrite) return;
        excluded.push(object);
        object.visible = false;
    };
    return {
        resize(width: number, height: number) {
            const ratio = renderer.getPixelRatio();
            color.setSize(
                Math.round(width * ratio),
                Math.round(height * ratio),
            );
            // Contact shading is low-frequency; denoise below CSS resolution.
            const scale = Math.min(ratio, 0.75);
            occlusion.setSize(
                Math.round(width * scale),
                Math.round(height * scale),
            );
        },
        render(updateShadows = true) {
            renderer.setRenderTarget(color);
            renderer.clear();
            renderer.render(planets, camera);
            // The lighting pass owns shadow updates. GTAO's normals pass can
            // reuse them; camera-only movement also leaves world shadows intact.
            renderer.shadowMap.needsUpdate = updateShadows;
            renderer.render(scene, camera);
            // Glass, light halos and distant backdrops do not write scene
            // depth. Treating them as solid in the normals pass produces dark
            // silhouettes and spends a second draw on invisible surfaces.
            excluded.length = 0;
            scene.traverse(hideDepthless);
            try {
                occlusion.render(renderer, color, color, 0, false);
            } finally {
                for (const object of excluded) object.visible = true;
            }
            renderer.setRenderTarget(null);
            renderer.clear();
            quad.render(renderer);
        },
        dispose() {
            renderer.shadowMap.autoUpdate = originalShadowAutoUpdate;
            color.dispose();
            occlusion.dispose();
            // The Three.js pass currently leaves these public materials allocated.
            occlusion.gtaoMaterial.dispose();
            occlusion.blendMaterial.dispose();
            composite.dispose();
            quad.dispose();
        },
    };
}
