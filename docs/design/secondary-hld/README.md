# Secondary-page visual design

These six ImageGen boards guide eight page layouts. They are concept references, not screenshots of the shipped website. Text and research figures in the implementation come from the existing CMS, not the illustrative text generated on a board.

| Page           | Visual design                               | Implementation                                                                                                                                                                           |
| -------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Projects       | [Orbital workshop](projects.png)            | A connected habitat ring, docking hub, service trusses, radiators and solar arrays above the lunar limb. Existing project imagery and ordering stay intact.                              |
| Writing        | [Deep-space observatory](writing.png)       | NASA's Webb geometry, lit gold mirrors, separated sunshield layers and a distant Saturn backdrop. An imagined composition, not a depiction of Webb's actual location.                    |
| About          | [Perception workbench](about.png)           | An articulated binocular instrument on a calibration deck, laboratory structure and smooth distant terrain.                                                                              |
| Contact        | [Earth relay](contact.png)                  | A communications satellite above Earth's horizon; the form remains the primary interaction. The generated board's additional surface settlement is omitted to keep the setting coherent. |
| Project detail | [Detail layouts, left](detail-layouts.png)  | Restrained orbital accent, technology labels, readable evidence and existing research figures.                                                                                           |
| Article        | [Detail layouts, right](detail-layouts.png) | A light trajectory ornament, clear contents and headings, quiet reading surface. No 3D renderer is loaded.                                                                               |
| Topic archive  | [Topic and 404, left](topic-and-404.png)    | A thin path connects dated entries.                                                                                                                                                      |
| 404            | [Topic and 404, right](topic-and-404.png)   | An escaped signal and simple orbital drawing lead to clear recovery links.                                                                                                               |

## Shared rules

- Preserve the established cream, amber, sage and rust palette, typography and navigation.
- Keep mechanical objects connected and ground the robot on a workbench. Use photographic planetary maps and restrained warm/cool illumination.
- Use gentle automatic motion and pointer parallax; respect manual pause, reduced motion, offscreen suspension and page visibility.
- Show a native scene capture while loading. Compile and finish the first GPU frame before fading to live graphics. Restore the static artwork after WebGL failure.
- Capture broad desktop/mobile frames and crop them at a fixed height, matching the live camera's vertical field of view at intermediate browser widths.
- Contact's preview and Earth lighting use the timezone initialized in the page head. Native preview captures cover dawn, day, dusk and night.
- Keep articles, detail headers, archives and 404 lightweight and readable without JavaScript.

## Reproduction and sources

The boards were generated with the built-in ImageGen tool. Exact prompts are saved in [prompts.json](prompts.json).

Run `ARTWORK_URL=http://127.0.0.1:8804 node scripts/artwork/capture-space-posters.mjs` against a local preview to reproduce the transparent WebP previews. `ARTWORK_KIND=observatory` restricts a capture to one scene. Increment the asset version when changing published captures.

The Writing scene uses NASA/Goddard's [James Webb Space Telescope (A) model](https://science.nasa.gov/3d-resources/james-webb-space-telescope-a/), downloaded as the original Draco-compressed GLB. The renderer normalizes its scale, adjusts materials for the site's lighting, and batches static geometry by material. The source geometry is preserved in `public/models/webb-observatory-v1.glb`. Other instruments, texture details and laboratory scenery are authored in TypeScript. Planetary and sky sources are documented in `public/images/trajectory/README.md`.
