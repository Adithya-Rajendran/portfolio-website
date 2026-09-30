# Trajectory textures

The maps for the 3D flight on `/resume/trajectory` (option C · Flight,
`components/trajectory/flight-gl.ts` and `flight-bodies.ts`). A wide screen
loads the 2k maps and the 4k sky; a phone loads the 1k maps and the 2k sky.

The page credits them in the figure line under the scene: "Textures: NASA;
Solar System Scope, CC BY 4.0".

**Solar System Scope** (by INOVE), <https://www.solarsystemscope.com/textures/>,
distributed under the **Creative Commons Attribution 4.0 International**
licence (CC BY 4.0, <https://creativecommons.org/licenses/by/4.0/>). Solar
System Scope bases its maps on NASA elevation and imagery data. We resized
and re-encoded them as WebP; the changes to each file are listed.

| File                   | Pixels    | Size     | Source file                                                                   | Changes                                                           |
| ---------------------- | --------- | -------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `earth-2k.webp`        | 2048×1024 | 98.9 KB  | <https://www.solarsystemscope.com/textures/download/2k_earth_daymap.jpg>      | —                                                                 |
| `earth-1k.webp`        | 1024×512  | 31.8 KB  | <https://www.solarsystemscope.com/textures/download/2k_earth_daymap.jpg>      | —                                                                 |
| `earth-water-1k.webp`  | 1024×512  | 4.7 KB   | <https://www.solarsystemscope.com/textures/download/2k_earth_daymap.jpg>      | The oceans as a two-level mask (blue over red by 18, and ≥ green) |
| `mars-2k.webp`         | 2048×1024 | 124.0 KB | <https://www.solarsystemscope.com/textures/download/2k_mars.jpg>              | —                                                                 |
| `mars-1k.webp`         | 1024×512  | 37.0 KB  | <https://www.solarsystemscope.com/textures/download/2k_mars.jpg>              | —                                                                 |
| `jupiter-2k.webp`      | 2048×1024 | 74.7 KB  | <https://www.solarsystemscope.com/textures/download/2k_jupiter.jpg>           | —                                                                 |
| `jupiter-1k.webp`      | 1024×512  | 26.2 KB  | <https://www.solarsystemscope.com/textures/download/2k_jupiter.jpg>           | —                                                                 |
| `saturn-strip-v1.webp` | 8×1024    | 1.1 KB   | <https://www.solarsystemscope.com/textures/download/2k_saturn.jpg>            | Each row averaged across longitude (Saturn's bands)               |
| `saturn-ring-1k.webp`  | 1024×64   | 4.8 KB   | <https://www.solarsystemscope.com/textures/download/2k_saturn_ring_alpha.png> | — (lossless: its alpha is its detail)                             |
| `moon-1k.webp`         | 1024×512  | 58.9 KB  | <https://www.solarsystemscope.com/textures/download/2k_moon.jpg>              | —                                                                 |
| `milky-way-4k.webp`    | 4096×2048 | 421.4 KB | <https://www.solarsystemscope.com/textures/download/8k_stars_milky_way.jpg>   | Brightened fourfold (the renderer dims it back)                   |
| `milky-way-2k.webp`    | 2048×1024 | 136.7 KB | <https://www.solarsystemscope.com/textures/download/8k_stars_milky_way.jpg>   | Brightened fourfold (the renderer dims it back)                   |

**NASA** Earth layers, public domain (credit NASA), from NASA's Visible Earth
and Earth Observatory:

| File                   | Pixels    | Size     | Source file                                                                                                                       | Changes                            |
| ---------------------- | --------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `earth-clouds-2k.webp` | 2048×1024 | 130.9 KB | Blue Marble clouds (id 57747), <https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg>           | Greyscale, softened, thin haze cut |
| `earth-clouds-1k.webp` | 1024×512  | 29.3 KB  | Blue Marble clouds (id 57747), <https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg>           | Greyscale, softened, thin haze cut |
| `earth-night-2k.webp`  | 2048×1024 | 35.2 KB  | Black Marble 2016 (id 144897), <https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144897/BlackMarble_2016_01deg_gray.jpg> | —                                  |
| `earth-night-1k.webp`  | 1024×512  | 8.6 KB   | Black Marble 2016 (id 144897), <https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144897/BlackMarble_2016_01deg_gray.jpg> | —                                  |

A wide screen loads 954.6 KB of these; a phone 339.2 KB. The maps and the
sky are lossy WebP; the ring, the Saturn strip and the water mask lossless.

`node scripts/encode-trajectory-textures.mjs` downloads the sources and writes
these files with sharp. Files in `/public` are cached immutably, so rename a
file when you re-encode it.
