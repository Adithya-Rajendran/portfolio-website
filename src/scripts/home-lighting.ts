import * as T from "three";

/** One sun drives the visible sky, surface shadows, and metal reflections. */
export const HOME_SUN_DIRECTION = new T.Vector3(-0.16, 0.14, -1).normalize();

export function makeHomeEnvironment(renderer: T.WebGLRenderer) {
    const width = 256,
        height = 128;
    const pixels = new Float32Array(width * height * 4);
    const ground = new T.Color(0.12, 0.075, 0.045);
    const horizon = new T.Color(0.22, 0.19, 0.17);
    const zenith = new T.Color(0.045, 0.095, 0.19);
    const color = new T.Color();
    const direction = new T.Vector3();
    for (let y = 0; y < height; y++) {
        const latitude = ((y + 0.5) / height - 0.5) * Math.PI;
        for (let x = 0; x < width; x++) {
            const longitude = ((x + 0.5) / width - 0.5) * Math.PI * 2;
            direction.set(
                Math.cos(latitude) * Math.cos(longitude),
                Math.sin(latitude),
                Math.cos(latitude) * Math.sin(longitude),
            );
            color.copy(direction.y < 0 ? ground : horizon);
            if (direction.y >= 0)
                color.lerp(zenith, T.MathUtils.smoothstep(direction.y, 0, 0.7));
            const angle = 1 - direction.dot(HOME_SUN_DIRECTION);
            const glow =
                0.2 * Math.exp(-angle * 7) + 9 * Math.exp(-angle * 1700);
            color.r += glow;
            color.g += glow * 0.61;
            color.b += glow * 0.31;
            const offset = (y * width + x) * 4;
            color.toArray(pixels, offset);
            pixels[offset + 3] = 1;
        }
    }
    const source = new T.DataTexture(
        pixels,
        width,
        height,
        T.RGBAFormat,
        T.FloatType,
    );
    source.mapping = T.EquirectangularReflectionMapping;
    source.needsUpdate = true;
    const generator = new T.PMREMGenerator(renderer);
    const environment = generator.fromEquirectangular(source);
    source.dispose();
    generator.dispose();
    return environment;
}
