/**
 * True when the name a WebGL context gives its renderer belongs to one with
 * no graphics hardware behind it, which draws every pixel on the processor:
 * a virtual machine, a browser whose GPU is disabled, an automated test.
 * A scene that costs a graphics card a few milliseconds costs such a
 * renderer seconds, so it is given less to draw.
 */
export function isSoftwareRenderer(name: string) {
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
}

/** The name a context gives its renderer, unmasked where the browser allows. */
export function rendererName(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
) {
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    return String(
        gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ??
            "",
    );
}
