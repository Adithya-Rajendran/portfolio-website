---
type: concept
title: The light of the rooms
depends: [docs/ref_lighting-checks.md]
---
# The light of the rooms

The light of a room has two parts.
The baked light is part of the surfaces, and it does not change when the camera moves.
The reflections change with the eye, and the engine calculates them for each frame.

## Baked light

- `blender/bake.py` bakes the base atlases with Cycles in Blender 5.0.1, at a maximum of 4,096 px. It uses a maximum of 192 samples, an adaptive threshold of 0.015 and a maximum of eight bounces.
- The angular passes have a different resolution and a different number of samples.
- `blender/bake.py` encodes the light as HDR in the linear color space of the scene. The site does the tone mapping.
- The rooms with a window keep six phases of the sky and of the bounce light of the sun. The Atrium also keeps three phases of the light of the orrery.
- The backdrop is a Cycles render of the outside only. It is not a lightmap of the inside.
- The fixed light and the contact shadows do not move when the camera moves.

## The sun through the window

- The direct sun of the window and its shadow map follow the roll of the station, which is 120 seconds long.
- The shadow camera points through the window.
- A 3 × 3 filter compares each texel with the depth of the triangle that the light goes to. It uses the ray of the sun for that texel.
- A bias of some millimeters prevents errors of calculation, and the shadow does not move away from the thing that casts it.
- The drone and the open book cast the light of the sun and receive it.
- Their PBR materials also receive the environment of the room, path traced and without the sun. They do not receive a studio light or a second copy of the sun.
- The fixed lamps do not trace shadows or bounce light again for the drone when it flies.

## Reflections

- The floor uses the current camera, in a mirror. The blur of the reflection comes from the roughness and from the distance to the surface in the reflection.
- The opaque parts of the drone also write their distance.
- The sky is at infinity for each eye that renders, which includes the mirror.
- The polished fittings do not bake a glossy lobe into the base. `blender/reflection_probe.py` renders a local Cycles panorama with 128 samples.
- The panorama changes to five layers of roughness in linear radiance.
- The site projects the reflected ray into a box, and uses the reflectance at normal incidence and the roughness of the material.
- The polished batches that the window lights also have a directional highlight with a shadow.
- Each room has one static probe. The engine does not trace the reflections between each pair of objects that move.
- The baked light keeps the sheen on rough surfaces.

## The chart of Navigation

- A planar pass on the chart of Navigation captures the live projected models and the reader over the static probe. It uses the eye in the reflection across the glass.
- This pass does not draw all of the room again.
- The notes of the reader do not emit light in this pass.

## Paper in the rooms

The printed field atlas is an original illustration in `blender/textures_dl/field-folio.svg`, with a PNG copy that Git keeps.
In the room, it is paper with light on it, not an HTML layer.

See [the lighting checks](ref_lighting-checks.md) to measure these properties in the browser.
