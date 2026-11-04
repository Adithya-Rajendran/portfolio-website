# Robotics landscape and mechanical studies

The current homepage uses a Blender/Cycles render of a grounded rover on an illustrative Mars landscape. The user requested this direct design pass after the procedural scene fell short of the planning image. The final scene removes the oversized background planet: its scale and local shadow made the composition physically incoherent.

The main scene combines NASA/JPL-Caltech's Perseverance geometry, scanned CC0 rock material, original terrain, atmospheric dust and consistent low sunlight. The camera and antenna on About and Contact are original mechanical studies modeled in Blender. They are illustrative, not hardware built by the portfolio owner.

The browser displays the finished compressed artwork immediately. A small Three.js shader uses a matching depth map for gentle automatic camera drift. Pause, reduced-motion preferences, visibility and context-loss fallback are supported. Visitors do not download Blender, the source model or Draco decoders. The experience page remains a separate interactive, scroll-driven 3D scene.

## Editable sources

- `scripts/artwork/render-horizon.py`: deterministic terrain, imported rover pose, lighting, atmosphere, camera and color/depth output.
- `scripts/artwork/render-studies.py`: original stereo camera and antenna geometry, materials and lighting.
- `assets/scenes/horizon.blend`: packed, editable final homepage scene.
- `assets/scenes/optics-study.blend` and `assets/scenes/signal-study.blend`: editable mechanical studies.
- `assets/scenes/models/`: original NASA source and provenance.
- `assets/scenes/textures/`: Poly Haven Rocks Ground 06 source maps.
- `public/images/scenes/`: optimized website deliveries and public credits.

Built with Blender 4.5.4 LTS, downloaded from Blender's official mirror and checked against its published SHA-256. These scenes use Cycles on the CPU and do not depend on an Isaac Sim installation or access to the Ascent.

From the repository root, using a local Blender executable:

```sh
blender -b --python scripts/artwork/render-horizon.py
blender -b --python scripts/artwork/render-studies.py
node scripts/artwork/encode-scenes.mjs
```

The rendering scripts write to `/tmp/portfolio-artwork`. The homepage script accepts `-- --preview` for a smaller composition check. Re-render, inspect the actual output and encode it before deployment. Delivered filenames are versioned because public assets are cached immutably; increment their version when replacing published images.

## Sources and credit

- [NASA/JPL-Caltech Perseverance model](https://science.nasa.gov/3d-resources/mars-2020-perseverance-rover/), adapted pose and neutral arm graphics; [NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/). No affiliation or endorsement is implied.
- [Rocks Ground 06](https://polyhaven.com/a/rocks_ground_06), Poly Haven, [CC0](https://polyhaven.com/license). Adapted color, scale and bump mapping.
- Manrope font: [Google Fonts source](https://github.com/google/fonts/tree/main/ofl/manrope), SIL Open Font License included beside the font.

## Planning references

`assets/artwork/robotics-horizon-v1.png` and `assets/artwork/experience-flow-v1.png` are earlier image-generation references. They are retained for art direction and are not served as production artwork. The final homepage follows the user's later request to build its visuals in Blender; its environment is deliberately more physically coherent than the speculative planet backdrop in the concept.
