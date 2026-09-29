# Trajectory textures

The planet maps for the 3D flight on `/resume/trajectory` (option C · Flight,
`components/trajectory/flight-gl.ts`). Every file is an equirectangular map
from **Solar System Scope** (by INOVE), <https://www.solarsystemscope.com/textures/>,
distributed under the **Creative Commons Attribution 4.0 International**
licence (CC BY 4.0, <https://creativecommons.org/licenses/by/4.0/>). Solar
System Scope bases the maps on NASA elevation and imagery data. We resized
them and re-encoded them as WebP; nothing else is changed.

The page credits them in the figure line under the scene: "Textures: Solar
System Scope, CC BY 4.0".

| File                  | Pixels    | Size     | Source file                                                                           |
| --------------------- | --------- | -------- | ------------------------------------------------------------------------------------- |
| `earth-2k.webp`       | 2048×1024 | 98.9 KB  | <https://www.solarsystemscope.com/textures/download/2k_earth_daymap.jpg>              |
| `mars-2k.webp`        | 2048×1024 | 124.0 KB | <https://www.solarsystemscope.com/textures/download/2k_mars.jpg>                      |
| `jupiter-2k.webp`     | 2048×1024 | 74.7 KB  | <https://www.solarsystemscope.com/textures/download/2k_jupiter.jpg>                   |
| `saturn-1k.webp`      | 1024×512  | 8.7 KB   | <https://www.solarsystemscope.com/textures/download/2k_saturn.jpg>                    |
| `saturn-ring-1k.webp` | 1024×64   | 4.8 KB   | <https://www.solarsystemscope.com/textures/download/2k_saturn_ring_alpha.png> (alpha) |

Total: 311.0 KB. The ring is lossless WebP (its alpha is its detail); the maps are lossy WebP.

`node scripts/encode-trajectory-textures.mjs` downloads the sources and writes
these files with sharp. Files in `/public` are cached immutably, so rename a
file when you re-encode it.
