# Trajectory textures

## Secondary scenes

The orbital workshop, communications satellite, robotic instrument, calibration deck and laboratory are original geometry authored in TypeScript. Their panel, optical, foil and solar-cell textures are generated in JavaScript. The backgrounds use the planetary and Milky Way sources credited below.

The Writing page uses **NASA/Goddard Space Flight Center**, [James Webb Space Telescope (A)](https://science.nasa.gov/3d-resources/james-webb-space-telescope-a/), from NASA's 3D Resources collection. The original GLB is served as `/models/webb-observatory-v1.glb`; scale, orientation, materials and lighting are adapted in the renderer. At runtime the mirror optics and sunshield foil surfaces are refined and static geometry is batched. The composition with Saturn is imaginative artwork, not Webb's actual orbital location.

The scenes use [Studio Small 09](https://polyhaven.com/a/studio_small_09) by Sergej Majboroda, from Poly Haven, as a high-dynamic-range environment for material reflections. It is distributed under [CC0](https://polyhaven.com/license). The local `/lighting/studio-small-09-v1.hdr` (1,615,248 bytes) is the [1K HDR source](https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr). The renderer combines environment lighting with scene lights and ground-truth ambient occlusion (GTAO).

The `workshop-*`, `observatory-*`, `robotics-*` and `relay-*` WebP files in `/images/scenes/` are transparent captures of these same live Three.js scenes, made with `scripts/artwork/capture-space-posters.mjs`. They provide the loading and no-WebGL views. Contact has matching dawn, day, dusk and night variants.

## Current Earth and Milky Way assets

The v2 Earth uses Solar System Scope's 8K [day map](https://www.solarsystemscope.com/textures/download/8k_earth_daymap.jpg), [clouds](https://www.solarsystemscope.com/textures/download/8k_earth_clouds.jpg), [night map](https://www.solarsystemscope.com/textures/download/8k_earth_nightmap.jpg), 2K [normal map](https://www.solarsystemscope.com/textures/download/2k_earth_normal_map.tif), and [specular map](https://www.solarsystemscope.com/textures/download/2k_earth_specular_map.tif), under CC BY 4.0. Adaptations: resized and encoded as WebP, then shaded with original lighting, cloud relief, ocean reflectance and atmosphere shaders.

- `earth-surface-v2-{8k,2k}.webp`: surface color.
- `earth-clouds-v2-{4k,2k}.webp`: separate cloud layer and surface shadows.
- `earth-lights-v2-{4k,2k}.webp`: cities on the unlit hemisphere.
- `earth-normal-v2-2k.webp`, `earth-water-v2-2k.webp`: relief and ocean reflectance.
- `earth-poster-v2-{dawn,day,dusk,night}.webp`: original Blender/Cycles CUDA renders using those maps, for loading and graphics fallback.

`milky-way-v2-{4k,2k}.webp` uses **ESO/S. Brunier**, [The Milky Way panorama, eso0932a](https://www.eso.org/public/images/eso0932a/), [CC BY 4.0](https://www.eso.org/public/outreach/copyright/). Adaptations: JavaScript perspective projection of the celestial sphere, 32-degree camera roll, resizing, reduced saturation/brightness and WebP encoding. Its visible page credit preserves the source's full wording. No AI image editing was used.

These assets are prepared with `scripts/artwork/prepare-orbit-assets.mjs`. Older maps below remain used by other planets or archived source components.

## Surface approaches

`moon-surface-v2-{4k,2k}.webp` and `mars-surface-v2-{4k,2k}.webp` are resized, WebP-encoded versions of Solar System Scope's [8K Moon](https://www.solarsystemscope.com/textures/download/8k_moon.jpg) and [8K Mars](https://www.solarsystemscope.com/textures/download/8k_mars.jpg) maps (CC BY 4.0). The larger maps preserve terrain detail during the descent into the planet-mounted settlements; small devices use 2K. Prepared by `scripts/artwork/prepare-orbit-assets.mjs`.

## Earlier planetary layers

The orbital experience on `/resume` uses these adapted NASA and Solar System Scope maps. The renderer selects smaller or larger maps according to device conditions and loads planetary resources when the orbital view starts. The page displays attribution beside the visual. The poster uses the Earth day map.

**Solar System Scope** (by INOVE), <https://www.solarsystemscope.com/textures/>,
distributed under the **Creative Commons Attribution 4.0 International**
licence (CC BY 4.0, <https://creativecommons.org/licenses/by/4.0/>). Solar
System Scope bases its maps on NASA elevation and imagery data. We resized
and re-encoded them as WebP; the changes to each file are listed.

| File                     | Pixels    | Size     | Source file                                                                   | Changes                                                                                  |
| ------------------------ | --------- | -------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `earth-2k.webp`          | 2048×1024 | 98.9 KB  | <https://www.solarsystemscope.com/textures/download/2k_earth_daymap.jpg>      | —                                                                                        |
| `earth-1k.webp`          | 1024×512  | 31.8 KB  | <https://www.solarsystemscope.com/textures/download/2k_earth_daymap.jpg>      | —                                                                                        |
| `earth-water-1k.webp`    | 1024×512  | 4.7 KB   | <https://www.solarsystemscope.com/textures/download/2k_earth_daymap.jpg>      | The oceans as a two-level mask (blue over red by 18, and ≥ green)                        |
| `mars-2k.webp`           | 2048×1024 | 124.0 KB | <https://www.solarsystemscope.com/textures/download/2k_mars.jpg>              | —                                                                                        |
| `mars-1k.webp`           | 1024×512  | 37.0 KB  | <https://www.solarsystemscope.com/textures/download/2k_mars.jpg>              | —                                                                                        |
| `jupiter-2k.webp`        | 2048×1024 | 74.7 KB  | <https://www.solarsystemscope.com/textures/download/2k_jupiter.jpg>           | —                                                                                        |
| `jupiter-1k.webp`        | 1024×512  | 26.2 KB  | <https://www.solarsystemscope.com/textures/download/2k_jupiter.jpg>           | —                                                                                        |
| `saturn-strip-v1.webp`   | 8×1024    | 1.1 KB   | <https://www.solarsystemscope.com/textures/download/2k_saturn.jpg>            | Each row averaged across longitude (Saturn's bands)                                      |
| `saturn-ring-1k.webp`    | 1024×64   | 4.8 KB   | <https://www.solarsystemscope.com/textures/download/2k_saturn_ring_alpha.png> | — (lossless: its alpha is its detail)                                                    |
| `moon-1k.webp`           | 1024×512  | 58.9 KB  | <https://www.solarsystemscope.com/textures/download/2k_moon.jpg>              | —                                                                                        |
| `milky-way-band-4k.webp` | 4096×2048 | 82.8 KB  | <https://www.solarsystemscope.com/textures/download/8k_stars_milky_way.jpg>   | Point stars taken out (a median filter), brightened fourfold (the renderer dims it back) |
| `milky-way-band-2k.webp` | 2048×1024 | 29.7 KB  | <https://www.solarsystemscope.com/textures/download/8k_stars_milky_way.jpg>   | Point stars taken out (a median filter), brightened fourfold (the renderer dims it back) |

**NASA** Earth layers, public domain (credit NASA), from NASA's Visible Earth
and Earth Observatory:

| File                          | Pixels    | Size     | Source file                                                                                                                       | Changes                            |
| ----------------------------- | --------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `earth-clouds-2k.webp`        | 2048×1024 | 130.9 KB | Blue Marble clouds (id 57747), <https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg>           | Greyscale, softened, thin haze cut |
| `earth-clouds-1k.webp`        | 1024×512  | 29.3 KB  | Blue Marble clouds (id 57747), <https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg>           | Greyscale, softened, thin haze cut |
| `earth-night-2k.webp`         | 2048×1024 | 35.2 KB  | Black Marble 2016 (id 144897), <https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144897/BlackMarble_2016_01deg_gray.jpg> | —                                  |
| `earth-night-sunrise-3k.webp` | 3072×1536 | 121.8 KB | Black Marble 2016 (id 144897), <https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144897/BlackMarble_2016_3km_gray.jpg>   | Cut to 130°W–30°W, 5°N–55°N        |
| `earth-night-sunrise-2k.webp` | 2048×1024 | 63.5 KB  | Black Marble 2016 (id 144897), <https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144897/BlackMarble_2016_3km_gray.jpg>   | Cut to 130°W–30°W, 5°N–55°N        |

The maps and sky are lossy WebP; the ring, Saturn strip and water mask are lossless. Actual transferred bytes depend on the selected world and device.

The enlarged desktop Earth also uses `earth-cinematic-4k.webp` (4096×2048), resized and encoded at WebP quality 90 from Solar System Scope's [8K Earth day map](https://www.solarsystemscope.com/textures/download/8k_earth_daymap.jpg). The same CC BY 4.0 attribution applies. The shader adjusts saturation, ocean reflectance and directional lighting; mobile retains the smaller map.

`node scripts/encode-trajectory-textures.mjs` downloads the sources and writes
these files with sharp. Files in `/public` are cached immutably, so rename a
file when you re-encode it.
