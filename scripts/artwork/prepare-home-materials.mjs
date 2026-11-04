import sharp from "sharp";

// Keep the authoring textures out of the browser bundle. These tiling maps
// support actual terrain geometry; the fallback posters come from that scene.
await sharp("assets/scenes/textures/rock-color.jpg")
    .resize(1024, 1024)
    .webp({ quality: 83, effort: 6 })
    .toFile("public/images/scenes/regolith-color-v1.webp");
await sharp("assets/scenes/textures/rock-height.jpg")
    .resize(1024, 1024)
    .webp({ quality: 88, effort: 6 })
    .toFile("public/images/scenes/regolith-height-v1.webp");
