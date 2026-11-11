# Interactive rover landscape

The homepage is an illustrative Three.js research landscape on measured terrain of Jezero crater, with a NASA/JPL-Caltech Perseverance rover and original built hardware: an outpost, a yard of greenhouses, solar field and guyed masts, a ribbed communications dish, a launch vehicle and a survey drone. It is a restrained scene with optical bloom, not a mission photograph or hardware built by the portfolio owner.

The rover is posed in Blender, baked into a static mesh, batched by material, and Draco-compressed to approximately 2.6 MB. The outpost, ship, drone and yard are separate built models (below). The lighting, camera and terrain handling are authored in TypeScript.

## Measured terrain and where interpretation begins

The ground is Jezero crater as the HiRISE camera measured it: three nested elevation grids (2 m, 16 m and 64 m posts) around a point on the crater floor south of an isolated butte of the western delta, with the orbital image's fine tone, 1 m surface normals for the innermost kilometre, and a skyline table for the land beyond the grids. These are derived from USGS Astrogeology Science Center products; `public/terrain/jezero-v1/CREDITS.md` is the source of truth for sources, DOIs and the citation, and nothing else should be claimed as data. `src/scripts/home-terrain.ts` loads the pack and places the scene's origin and heading.

Interpretation begins where the data runs out. The butte is measured every two metres, which keeps its bulk and loses its beds, so `src/scripts/home-relief.ts` cuts ledges back into the measured slope along its own contours and never adds height. Below a metre or so, `public/terrain/floor-v1/` supplies the floor detail and the ground shader draws the rover's ruts. The built hardware is original work. None of these is a survey.

## Built hardware

The outpost, ship, drone and yard are original models made with a procedural Python modelling toolkit that is not part of this repository, exported as GLB with named materials and a `COLOR_0` vertex channel (red ambient occlusion, green grime, blue edge wear) and Draco-compressed; `public/models/README.md` lists them. No third-party or vendor sample assets are in them. The site swaps each named material for its own finish (`finishes` and `builtFinish` in `src/scripts/home-frontier.ts`) and uses the vertex channel for dust and wear. Coarse-pointer (touch) devices load the `-lite` outpost (226,718 triangles, against 518,610) and yard (68,644, against 150,546). The code drives nodes by name: `dish_az` on the outpost, and `rotor_*`, `gimbal` and `drone_beacon` on the drone.

The outpost is flight hardware rather than architecture, with pressure modules, tunnels, radiators and foil tanks, each carrying a stencilled designation. The yard holds two greenhouses with an airlock, a solar field and two guyed masts. The launch vehicle stands set well back beyond the first ridge, at a believable scale. Surfaces near the ground take on the colour of the regolith and lose some of their sheen, so dust appears to have settled on everything standing in it. Three scene selections (Rover, Outpost and Signal) move the camera smoothly between points of interest. Pointer movement adds gentle perspective motion, while touch devices retain native scrolling.

## Survey drone

The drone flies a closed round of 66 s, a centripetal Catmull-Rom curve through the `SURVEY` stops in `home-frontier.ts`, each with its own pace and sweep. It carries a push-broom lidar fan. A scan line and a fading 11 cm world-anchored lattice are drawn on every scene material through the shared `applyHomeHaze` hook (`HOME_SURVEY` uniforms and `HOME_SURVEY_GLSL` in `home-lighting.ts`), together with an analytic shadow of the aircraft. At rest the uniforms are zero. With reduced motion the drone stays parked.

## Ground detail

`scripts/artwork/make-home-floor.mjs` bakes one seamless 8 m square of crater floor: fractured slabs with sand-filled joints, drift and ripples, about 13.9k stones, their slopes, and the micro-shadow each slab edge and stone throws under the scene's fixed sun. The output is in `public/terrain/floor-v1/` (2048 px) and `public/terrain/floor-v1/half/` (1024 px, for coarse pointers). `src/scripts/home-floor.ts` merges the four pictures into one relief texture and a colour texture, and the ground shader cross-fades two offset copies of the square so the repeat does not show. It is procedural interpretation of such ground, not a survey of the site and not third-party data.

The rover's ruts are drawn analytically in the ground shader along `TRACK` in `home-landscape.ts`: a straight, a 9 m bend and a straight, two ruts 3 m apart with a pressed floor, raised lips and grouser bars. Stones are cut lumps with creased normals, three of them placed by hand (`SET_STONES`), and are cleared from the ruts and from the staked cable way (`HOME_CABLE_WAY`).

Real GPUs differ from software rasterisers here. A texture lookup or screen-space derivative inside a runtime branch returns garbage along the branch's edge, and software rasterisers hide this. The ground shader therefore samples every scale unconditionally and blends by weight, and the ruts are written without branches because derivatives are taken. Check shader changes on a real GPU.

“Explore scene” opens deliberate camera control. Drag to orbit, right-drag or Shift-drag to pan, and use the wheel or zoom buttons to move closer. Touch uses one finger to orbit and two fingers to pan or pinch. These gestures are captured only inside the scene while exploration is open; normal page scrolling remains available outside it. Arrow keys orbit, Shift + arrows pan, +/− zoom, Home resets the selected view, and Escape or Done restores the page composition. Preset travel yields immediately to manual input. Broad target and distance limits, smooth terrain clearance and surrounding ground keep the camera within the landscape. Manual controls remain available with ambient motion paused or reduced motion enabled.

Version 5 desktop, tablet and mobile posters (2160×1095, 1152×692 and 585×512) were recaptured from the finished scene on a real GPU. They have not been published before, so the version was not bumped. The matching poster appears immediately and remains available without JavaScript, on loading failure or after graphics-context loss. The perspective camera uses the same reference dimensions and cover crop as the poster. After assets, shaders and the first GPU frame are ready, the scene fades over the retained poster for 900 ms; reduced motion skips the fade. Pointer input begins after the transition, so movement during loading cannot displace the initial composition.

The scene is drawn once per frame into a single multisampled HDR target; the canvas itself is created without antialiasing and the renderer applies no tone mapping. Everything after that is a full-screen pass. The first applies exposure and the contact shade. A light spread from the brightest areas follows. One final film conversion then maps the result to the display. On wide views it includes a left-hand light falloff that makes room for the page's text, and it also adds a vignette and half a display step of dither against banding in the sky. The falloff opens while a visitor explores the scene.

On viewports wider than 1576 px the scene box starts at the content column's left edge (`--scene-left`) rather than the viewport edge, and the veil's left-hand gradient is measured from there. The hero's minimum height is `clamp(680px, 90svh − 80px, max(860px, 34vw))`, so it may exceed 860 px on a very wide screen.

Ambient detail renders at up to 30 frames per second; camera movement follows the display cadence. The scene clock freezes while paused, offscreen, in hidden tabs or under reduced motion. A destination can still be selected while paused or under reduced motion, producing a static view. Graphics resources, pending fades and listeners are released on page exit, including exit during loading. A restored page starts at Rover so the first scene matches its fallback; a manual pause remains in effect.

Terrain uses a nonuniform grid with continuous normals, concentrating geometry around the rover and settlement. Spatial patches and separate settlement/launch batches let Three.js cull the current camera's unseen regions; turning the camera restores them automatically. The surrounding terrain remains available through a full orbit. The page's Milky Way backdrop is loaded at 1k on screens up to 800 px wide, and otherwise at 2k or, for a canvas wider than 2400 device pixels, 4k. Distant ground uses broad, fixed texture coordinates and fades fine bump detail to avoid a repeating horizon. Pebbles use simpler shared geometry, the sky draws after opaque surfaces, and bloom runs below the scene's color resolution. A GPU fence limits outstanding frames, and resizing a hidden scene defers its draw until it becomes visible.

Triangle counts for the built models are given above. Earlier opening-view submission figures came from a software-rendered capture of the previous scene and no longer apply; measure again on a real GPU before quoting any.

A browser with no graphics hardware behind it (a virtual machine, a disabled GPU, the automated browser tests) draws every pixel on the processor. `src/lib/renderer-kind.ts` recognises such a renderer by the name its context reports, and the scene then takes the lighter set a touch device gets (the `-lite` models, one lander, the half-size floor, a 2048 px shadow map), turns off anisotropic filtering and draws its HDR target without multisampling. Measured in the test container at 1280×720, that brings the first frame from about 51 s to about 22 s, and a frame in motion from as much as 18 s to about 3 s; most of the difference is the filtering across the ground's long view, then the multisampling. A graphics card is not affected.

The sky, direct light, directional haze, shadows and procedural HDR reflections share one sun direction. The sun is low and sits three-quarters behind the composed views, just outside the frame, so forms turn from a warm lit edge into cool shade and shadows rake toward the lower left. A visitor who turns to face it finds a true disc. The sun is the main light; sky light is far weaker and there is no camera-side fill. Haze takes its colour from the horizon behind each fragment, warm toward the sun and cool away from it. Contact shading uses a shorter-range camera and a reduced-resolution normals pass, excluding glass, sky and details that are not marked as solid. Its result is reused until the camera or canvas size changes. While the camera eases during ambient motion it may be refreshed about 12 times a second rather than on every frame. Geometry counters on a frame that refreshes it include this extra pass and should be assessed separately from other frames. The rover retains clear metal highlights, greenhouses use reflective glazing without a second refraction render, and the rover's ruts are part of the ground. Camera easing uses elapsed wall time while ambient simulation remains capped, so slow frames do not stretch guided moves indefinitely.

## Settlement site pipeline

The Experience page's Moon and Mars settlements (`public/models/{moon,mars}-outpost-v3.glb` and `-lite-v3`) and the Projects page's orbital dry dock (`orbital-workshop-v1.glb`) are built outside this repository; `public/models/README.md` lists them. A settlement's ground is made from what its builder hands over:

1. `assets/scenes/settlements/<world>/site.json`, `ground-ao.png` and `ground-contact.png`: labels, pads, lanes, blast zones, landmarks, and the shade and contact the hardware leaves on the ground.
2. `node scripts/artwork/make-settlement-heights.mjs <moon|mars> <model.glb>` writes `assets/scenes/settlements/<world>/heights.png`, a 128 by 128 grid over the 512 m site with one byte a square (byte times 0.25 m is the height of solid fixed hardware). It needs the builder's plain, not Draco-compressed, GLB, which is not kept in the repository; without it, keep the committed `heights.png`.
3. `node scripts/artwork/make-settlement-ground.mjs <world>` writes `public/terrain/<world>-site-v1/` (and `half/` for coarse devices): the site maps and a `site.json` manifest with `labels`, `sun`, `landmarks` and `heights` (base64). `src/scripts/settlement-skyline.ts` reads `heights` so that captions name only structures a view can see.

Stills for the study scenes are versioned per scene, because they are cached immutably: the workshop is v4 and the observatory, robotics and relay are v3. The versions are set in `src/components/SpaceStudy.astro` and in `scripts/artwork/capture-space-posters.mjs`, and must change together.

## Reproducible sources

- `src/scripts/home-terrain.ts`: loads the measured Jezero pack (`public/terrain/jezero-v1/`) and places the site and heading.
- `src/scripts/home-relief.ts`: the butte's ledges, cut back into the measured slope.
- `src/scripts/home-floor.ts`: loads the baked floor square and merges it into relief and colour textures.
- `src/scripts/home-landscape.ts`: ground shader (floor cross-fade, rover ruts, stones), sun and shadow, sky texture selection, model loading and responsive camera composition.
- `src/scripts/landscape-geometry.ts`: continuous terrain grids and spatial patches with preserved normals and texture coordinates.
- `src/scripts/home-frontier.ts`: loads the built models, swaps their named materials for site finishes, and drives the dish, drone survey round and ambient animation.
- `src/scripts/home-rendering.ts`: the multisampled HDR scene target, exposure with contact shade, light spread, and the final film conversion with text falloff, vignette and dither.
- `src/scripts/home-lighting.ts`: the shared sun direction, sky and haze shader code, the survey scan uniforms and GLSL, the settled-dust finish, and a procedural outdoor reflection environment.
- `src/scripts/home-occlusion.ts`: contact shading with limited refresh, static-geometry selection and graphics-state cleanup.
- `src/scripts/home-visual.ts`: destination selection, pointer easing, loading, motion preferences, visibility and resource lifecycle.
- `src/scripts/home-camera.ts`: orbit/pan/zoom input, interrupted guided travel, bounds and keyboard control.
- `src/lib/home-framing.ts`: shared capture dimensions and cover-crop calculation. Update these dimensions if the source posters change.
- `scripts/artwork/prepare-home-rover.py`: export the posed rover from the editable Blender source.
- `scripts/artwork/prepare-home-materials.mjs`: prepare the compact tiling regolith textures.
- `scripts/artwork/make-home-floor.mjs`: bake the seamless crater floor square into `public/terrain/floor-v1/`.
- `scripts/artwork/capture-home-posters.mjs`: capture the actual 3D scene without its HTML overlays and encode fallback posters.
- `assets/scenes/horizon.blend`: packed Blender 4.5.4 source for the rover's deployed pose.
- `assets/scenes/models/`: original NASA model and provenance.
- `assets/scenes/textures/`: Poly Haven Rocks Ground 06 source maps.
- `public/models/home-rover-v1.glb`: compressed browser delivery of the rover.
- `public/models/home-{outpost,ship,drone,yard}-v1.glb` and the `-lite` outpost and yard: built hardware; see `public/models/README.md`.
- `public/terrain/jezero-v1/` and `public/terrain/floor-v1/`: measured terrain pack and baked floor square, each with its README or CREDITS file.

From the repository root:

```sh
blender -b --python scripts/artwork/prepare-home-rover.py
node scripts/artwork/prepare-home-materials.mjs
node scripts/artwork/make-home-floor.mjs
ARTWORK_URL=http://127.0.0.1:4321 node scripts/artwork/capture-home-posters.mjs
```

Start the local site before capturing posters. Review the actual desktop and mobile browser renders before deployment. Public asset filenames are versioned because they are cached immutably; increment their version when replacing published assets.

The earlier `render-horizon.py`, `render-studies.py` and `encode-scenes.mjs` scripts retain the Blender/Cycles authoring workflow. The old depth-map shader is no longer used by the homepage. Projects, Writing, About and Contact now have their own native Three.js studies; the experience page remains a separate scroll-driven orbital scene.

## Sources and credit

- [NASA/JPL-Caltech Perseverance model](https://science.nasa.gov/3d-resources/mars-2020-perseverance-rover/), adapted pose and neutral arm graphics; [NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/). No affiliation or endorsement is implied.
- Terrain: USGS Astrogeology Science Center, Mars 2020 TRN HiRISE DTM and orthoimage mosaics (Fergason et al., 2020); HiRISE image: NASA/JPL/University of Arizona. Derived data; see `public/terrain/jezero-v1/CREDITS.md`.
- [Rocks Ground 06](https://polyhaven.com/a/rocks_ground_06), Poly Haven, [CC0](https://polyhaven.com/license). Adapted color, scale and bump mapping.
- Milky Way photography: ESO/S. Brunier, as credited with the orbital texture assets.
- The locally hosted Draco decoder is distributed under Apache-2.0; see `public/draco/LICENSE`.

## Planning references

`assets/artwork/robotics-horizon-v1.png` and `assets/artwork/experience-flow-v1.png` are earlier image-generation references. They are retained for art direction and are not served as production artwork. The current landscape removes the physically incoherent oversized background planet from the early concept.
