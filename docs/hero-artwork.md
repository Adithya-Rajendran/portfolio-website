# Interactive rover landscape

The homepage is a real Three.js scene: a detailed NASA/JPL-Caltech Perseverance rover on a smooth, textured, illustrative Mars landscape. A small perspective-camera movement follows the mouse within the hero, with exponential easing and a gentle return to center on leaving. The rover, rocks and distant ridgelines have independent parallax. The scene is illustrative, not hardware built by the portfolio owner or a mission photograph.

The model is posed in Blender, baked into a static mesh, batched by material, and Draco-compressed to approximately 2.6 MB. The landscape, rock instances, dusty horizon, sky, lights and camera are built in TypeScript. Small rover lenses use reflective materials without a costly full-scene refraction pass. The existing amber, terracotta and charcoal palette carries into the lighting.

A matching rendered poster appears immediately while the model loads and remains available without JavaScript, on loading failure or after graphics-context loss. Once ready, the native 3D scene replaces it. Touch devices retain natural scrolling and use a centered composition. Pause and the system reduced-motion setting freeze the camera. Rendering stops offscreen, in hidden tabs and when the pointer-driven camera settles; shadows render once. Graphics resources and listeners are released on page exit, including exit during asset loading.

## Reproducible sources

- `src/scripts/home-landscape.ts`: terrain, materials, lighting, model loading and responsive camera composition.
- `src/scripts/home-visual.ts`: pointer easing, loading, motion preferences, visibility and resource lifecycle.
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
