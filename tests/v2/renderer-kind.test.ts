import { describe, expect, it } from "vitest";
import { isSoftwareRenderer, rendererName } from "../../src/lib/renderer-kind";

describe("renderer kind", () => {
    it("recognises renderers that draw on the processor", () => {
        for (const name of [
            "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
            "llvmpipe (LLVM 17.0.6, 256 bits)",
            "softpipe",
            "Microsoft Basic Render Driver",
            "Apple Software Renderer",
        ])
            expect(isSoftwareRenderer(name), name).toBe(true);
    });

    it("leaves graphics hardware alone", () => {
        for (const name of [
            "ANGLE (NVIDIA, NVIDIA GeForce GTX 1050 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)",
            "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)",
            "Mali-G78",
            "Adreno (TM) 740",
            "ANGLE (Intel, Mesa Intel(R) UHD Graphics 630 (CFL GT2), OpenGL 4.6)",
            "",
        ])
            expect(isSoftwareRenderer(name), name).toBe(false);
    });

    it("prefers the unmasked name and falls back to the masked one", () => {
        const context = (unmasked: boolean) =>
            ({
                RENDERER: 7937,
                getExtension: () =>
                    unmasked ? { UNMASKED_RENDERER_WEBGL: 37446 } : null,
                getParameter: (key: number) =>
                    key === 37446 ? "SwiftShader" : "WebKit WebGL",
            }) as unknown as WebGLRenderingContext;
        expect(rendererName(context(true))).toBe("SwiftShader");
        expect(rendererName(context(false))).toBe("WebKit WebGL");
    });
});
