import * as T from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { isSoftwareRenderer, rendererName } from "../lib/renderer-kind";
import { makeHomeOcclusion } from "./home-occlusion";

const vertexShader = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;

/**
 * The scene is drawn once into a multisampled HDR target; everything after it
 * is a full-screen pass that needs no multisampling: exposure and contact
 * shade, a light spread from the brightest areas, then one film-style
 * conversion to the display with a restrained grade.
 */
export function makeHomeRendering(
    renderer: T.WebGLRenderer,
    scene: T.Scene,
    camera: T.PerspectiveCamera,
) {
    // Without graphics hardware, four samples a pixel double the cost of a
    // frame that already takes seconds.
    const color = new T.WebGLRenderTarget(1, 1, {
        type: T.HalfFloatType,
        samples: isSoftwareRenderer(rendererName(renderer.getContext()))
            ? 0
            : 4,
    });
    const exposed = new T.WebGLRenderTarget(1, 1, {
        type: T.HalfFloatType,
        depthBuffer: false,
    });
    const contact = makeHomeOcclusion(renderer, scene, camera);
    // Exposure is applied before the light spread so its threshold means
    // "brighter than the display's white" whatever the scene's units are.
    const expose = new FullScreenQuad(
        new T.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: color.texture },
                contact: { value: contact.texture },
                exposure: { value: 1.3 },
            },
            vertexShader,
            fragmentShader: `uniform sampler2D tDiffuse,contact;uniform float exposure;varying vec2 vUv;
                void main(){
                    vec3 scene=texture2D(tDiffuse,vUv).rgb;
                    // One undefined sample must not become a glare: without
                    // this a NaN reaches the light spread as the clamp value.
                    if(any(isnan(scene))||any(isinf(scene))) scene=vec3(0.);
                    scene=clamp(scene,0.,48.);
                    float ao=texture2D(contact,vUv).r;
                    gl_FragColor=vec4(scene*exposure*mix(1.,max(ao,.3),.6),1.);
                }`,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
        }),
    );
    const glow = new UnrealBloomPass(new T.Vector2(1, 1), 0.2, 0.5, 1.7);
    const grade = new FullScreenQuad(
        new T.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: exposed.texture },
                shade: { value: new T.Vector3(0, 1, 0) },
            },
            vertexShader,
            fragmentShader: `uniform sampler2D tDiffuse;uniform vec3 shade;varying vec2 vUv;
                #include <tonemapping_pars_fragment>
                void main(){
                    vec3 scene=texture2D(tDiffuse,vUv).rgb;
                    // A lens that falls off gently toward its corners.
                    vec2 lens=(vUv-.5)*vec2(1.,.82);
                    scene*=mix(1.,.72,smoothstep(.28,.82,length(lens)));
                    // Light falls away toward the words beside the scene.
                    scene*=mix(1.,mix(.12,1.,smoothstep(shade.x,shade.y,vUv.x)),shade.z);
                    vec3 graded=ACESFilmicToneMapping(scene);
                    float luma=dot(graded,vec3(.2126,.7152,.0722));
                    // Shade leans toward the page's blue-green ink and light
                    // stays warm, so the image sits inside the layout.
                    graded=mix(graded,graded*vec3(.8,1.,1.16)+vec3(.002,.005,.007),1.-smoothstep(0.,.34,luma));
                    graded=mix(vec3(luma),graded,1.06);
                    gl_FragColor=sRGBTransferOETF(vec4(clamp(graded,0.,1.),1.));
                    // Half a display step of noise removes banding in the sky.
                    float grain=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
                    gl_FragColor.rgb+=(grain-.5)/255.;
                }`,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
        }),
    );
    const shade = (grade.material as T.ShaderMaterial).uniforms.shade
        .value as T.Vector3;
    let shaded = false,
        open = false,
        began = -Infinity,
        origin = 0;
    return {
        /** Where, across the canvas, light gives way to the page's text. */
        shade(active: boolean, from: number, to: number) {
            if (shaded !== active) began = -Infinity;
            shaded = active;
            shade.x = from;
            shade.y = to;
        },
        /** Follows the 350 ms fade of the text the shade makes room for. */
        reveal(exploring: boolean, instant: boolean) {
            if (open === exploring) return;
            open = exploring;
            origin = shade.z;
            began = instant ? -Infinity : performance.now();
        },
        get occlusionUpdates() {
            return contact.updates;
        },
        /** `settling` lets a moving camera reuse recent contact shading. */
        render(settling = false) {
            contact.update(color, settling);
            renderer.setRenderTarget(color);
            renderer.render(scene, camera);
            renderer.setRenderTarget(exposed);
            expose.render(renderer);
            glow.render(renderer, exposed, exposed, 0, false);
            const progress = Math.min(1, (performance.now() - began) / 350);
            shade.z = T.MathUtils.lerp(
                origin,
                shaded && !open ? 1 : 0,
                progress * progress * (3 - 2 * progress),
            );
            renderer.setRenderTarget(null);
            grade.render(renderer);
        },
        resize(width: number, height: number) {
            const ratio = renderer.getPixelRatio();
            color.setSize(width * ratio, height * ratio);
            exposed.setSize(width * ratio, height * ratio);
            contact.resize(width, height);
            // Light spread needs no more than CSS resolution, even on Retina.
            glow.setSize(width, height);
        },
        dispose() {
            contact.dispose();
            expose.material.dispose();
            expose.dispose();
            grade.material.dispose();
            grade.dispose();
            glow.dispose();
            color.dispose();
            exposed.dispose();
        },
    };
}
