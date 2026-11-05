# Interactive rover landscape

The homepage is an illustrative Three.js research landscape with a NASA/JPL-Caltech Perseverance rover, original connected habitats, geodesic greenhouses with interiors, a parabolic communications dish, and a distant launch structure. A drone and terrain-following scan add subtle movement, with a restrained optical bloom. The environment is illustrative, not a mission photograph or hardware built by the portfolio owner.

The rover is posed in Blender, baked into a static mesh, batched by material, and Draco-compressed to approximately 2.6 MB. The terrain, habitats, greenhouses, dish, launch structure, lighting and camera are authored in TypeScript. Three scene selections—Rover, Outpost and Signal—move the camera smoothly between points of interest. Pointer movement adds gentle perspective motion, while touch devices retain native scrolling.

“Explore scene” opens deliberate camera control. Drag to orbit, right-drag or Shift-drag to pan, and use the wheel or zoom buttons to move closer. Touch uses one finger to orbit and two fingers to pan or pinch. These gestures are captured only inside the scene while exploration is open; normal page scrolling remains available outside it. Arrow keys orbit, Shift + arrows pan, +/− zoom, Home resets the selected view, and Escape or Done restores the page composition. Preset travel yields immediately to manual input. Broad target and distance limits, smooth terrain clearance and surrounding ground keep the camera within the landscape. Manual controls remain available with ambient motion paused or reduced motion enabled.

Version 2 desktop, tablet and mobile posters are captured from the scene. The matching poster appears immediately and remains available without JavaScript, on loading failure or after graphics-context loss. The perspective camera uses the same reference dimensions and cover crop as the poster. After assets, shaders and the first GPU frame are ready, the scene fades over the retained poster for 900 ms; reduced motion skips the fade. Pointer input begins after the transition, so movement during loading cannot displace the initial composition.

Ambient detail renders at up to 30 frames per second; camera movement follows the display cadence. The scene clock freezes while paused, offscreen, in hidden tabs or under reduced motion. A destination can still be selected while paused or under reduced motion, producing a static view. Graphics resources, pending fades and listeners are released on page exit, including exit during loading. A restored page starts at Rover so the first scene matches its fallback; a manual pause remains in effect.

## Reproducible sources

- `src/scripts/home-landscape.ts`: terrain, lighting, model loading and responsive camera composition.
- `src/scripts/home-frontier.ts`: original architecture, greenhouse interiors, dish, launch structure, procedural panel materials and ambient animation. Static details are merged by material.
- `src/scripts/home-rendering.ts`: antialiased HDR rendering, subtle light spread and final tone/color conversion.
- `src/scripts/home-visual.ts`: destination selection, pointer easing, loading, motion preferences, visibility and resource lifecycle.
- `src/scripts/home-camera.ts`: orbit/pan/zoom input, interrupted guided travel, bounds and keyboard control.
- `src/lib/home-framing.ts`: shared capture dimensions and cover-crop calculation. Update these dimensions if the source posters change.
- `scripts/artwork/prepare-home-rover.py`: export the posed rover from the editable Blender source.
- `scripts/artwork/prepare-home-materials.mjs`: prepare the compact tiling terrain textures.
- `scripts/artwork/capture-home-posters.mjs`: capture the actual 3D scene without its HTML overlays and encode fallback posters.
- `assets/scenes/horizon.blend`: packed Blender 4.5.4 source for the rover's deployed pose.
- `assets/scenes/models/`: original NASA model and provenance.
- `assets/scenes/textures/`: Poly Haven Rocks Ground 06 source maps.
- `public/models/home-rover-v1.glb`: compressed browser delivery.

From the repository root:

```sh
blender -b --python scripts/artwork/prepare-home-rover.py
node scripts/artwork/prepare-home-materials.mjs
ARTWORK_URL=http://127.0.0.1:4321 node scripts/artwork/capture-home-posters.mjs
```

Start the local site before capturing posters. Review the actual desktop and mobile browser renders before deployment. Public asset filenames are versioned because they are cached immutably; increment their version when replacing published assets.

The earlier `render-horizon.py`, `render-studies.py` and `encode-scenes.mjs` scripts retain the Blender/Cycles authoring workflow. The old depth-map shader is no longer used by the homepage. Projects, Writing, About and Contact now have their own native Three.js studies; the experience page remains a separate scroll-driven orbital scene.

## Sources and credit

- [NASA/JPL-Caltech Perseverance model](https://science.nasa.gov/3d-resources/mars-2020-perseverance-rover/), adapted pose and neutral arm graphics; [NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/). No affiliation or endorsement is implied.
- [Rocks Ground 06](https://polyhaven.com/a/rocks_ground_06), Poly Haven, [CC0](https://polyhaven.com/license). Adapted color, scale and bump mapping.
- Milky Way photography: ESO/S. Brunier, as credited with the orbital texture assets.
- The locally hosted Draco decoder is distributed under Apache-2.0; see `public/draco/LICENSE`.

## Planning references

`assets/artwork/robotics-horizon-v1.png` and `assets/artwork/experience-flow-v1.png` are earlier image-generation references. They are retained for art direction and are not served as production artwork. The current landscape removes the physically incoherent oversized background planet from the early concept.
