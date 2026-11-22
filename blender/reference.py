"""Path-traced ground truth for a browser pose: the built room as authored (sun at the authored roll, orrery at rest).
  blender -b lobby.blend -P reference.py -- out-dir 'name:ex,ey,ez:tx,ty,tz' ... [--spp 256] [--size 1280x720] [--exposure 0.85]
Poses use three.js world metres (Blender x, z, -y), vertical field of view 50 degrees, like tools/docker/poses.mjs.
The scene-linear render goes through the site's own display transform (public/js/post.js: log contrast 1.3,
saturation 1.08, three.js AgX at the room's exposure, sRGB), so compare it with ?bloom=0&vig=0&grain=0 captures.
Browser-only things (screen pages, hologram, dust) are not in it; Blender's placeholders are.
"""
import bpy, math, os, sys, tempfile
import numpy as np
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
out = a[0]; specs = [x for x in a[1:] if ':' in x]
spp = int(a[a.index('--spp') + 1]) if '--spp' in a else 256
w, h = map(int, (a[a.index('--size') + 1] if '--size' in a else '1280x720').split('x'))
s = bpy.context.scene
s.render.engine = 'CYCLES'
dev = os.environ.get('LOBBY_DEVICE', 'CUDA'); prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = dev; prefs.get_devices()
for d in prefs.devices: d.use = d.type == dev
s.cycles.device = 'GPU'; s.cycles.samples = spp; s.cycles.use_denoising = True; s.cycles.seed = 1
s.render.resolution_x, s.render.resolution_y, s.render.resolution_percentage = w, h, 100
s.render.film_transparent = False
st = s.render.image_settings; st.file_format = 'OPEN_EXR'; st.color_mode = 'RGB'; st.color_depth = '32'; st.color_management = 'FOLLOW_SCENE'
s.view_settings.view_transform = 'Standard'; s.view_settings.look = 'None'; s.view_settings.exposure = 0; s.view_settings.gamma = 1
EXPOSURE = float(a[a.index('--exposure') + 1]) if '--exposure' in a else 0.85
COL = lambda *v: np.array(v, np.float64).reshape(3, 3).T          # GLSL mat3(col, col, col)
REC2020 = COL(0.6274, 0.0691, 0.0164, 0.3293, 0.9195, 0.0880, 0.0433, 0.0113, 0.8956)
SRGB = COL(1.6605, -0.1246, -0.0182, -0.5876, 1.1329, -0.1006, -0.0728, -0.0083, 1.1187)
INSET = COL(0.856627153315983, 0.137318972929847, 0.11189821299995, 0.0951212405381588, 0.761241990602591, 0.0767994186031903,
            0.0482516061458583, 0.101439036467562, 0.811302368396859)
OUTSET = COL(1.1271005818144368, -0.1413297634984383, -0.14132976349843826, -0.11060664309660323, 1.157823702216272, -0.11060664309660294,
             -0.016493938717834573, -0.016493938717834257, 1.2519364065950405)
def browser_look(c):
    c = 0.18 * np.power(np.maximum(c / 0.18, 1e-6), 1.3)
    l = (c @ np.array([0.2126, 0.7152, 0.0722]))[..., None]; c = np.maximum(l + (c - l) * 1.08, 0)
    c = c * EXPOSURE @ REC2020.T @ INSET.T
    x = np.clip((np.log2(np.maximum(c, 1e-10)) + 12.47393) / (4.026069 + 12.47393), 0, 1); x2 = x * x; x4 = x2 * x2
    c = 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232
    c = np.clip(np.power(np.maximum(c @ OUTSET.T, 0), 2.2) @ SRGB.T, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)
if '--only-sun' in a:                    # QA: where direct sunlight lands (compare ?baked=0&env=0 in the browser)
    for world in bpy.data.worlds:
        for n in (world.node_tree.nodes if world.node_tree else []):
            if n.type == 'BACKGROUND': n.inputs['Strength'].default_value = 0
    for m in bpy.data.materials:
        b = next((n for n in (m.node_tree.nodes if m.node_tree else []) if n.type == 'BSDF_PRINCIPLED'), None)
        if b: b.inputs['Emission Strength'].default_value = 0
    for o in s.objects:
        if o.type == 'LIGHT' and o.data.type != 'SUN': o.data.energy = 0
    if 'Outside' in bpy.data.collections: bpy.data.collections['Outside'].hide_render = True
    s.cycles.max_bounces = 0
    if '--white' in a:                    # sun visibility alone: every surface the same matte white
        wm = bpy.data.materials.new('QAWhite'); wm.use_nodes = True; wb = wm.node_tree.nodes['Principled BSDF']
        wb.inputs['Base Color'].default_value = (0.8, 0.8, 0.8, 1); wb.inputs['Roughness'].default_value = 1.0; wb.inputs['Specular IOR Level'].default_value = 0
        bpy.context.view_layer.material_override = wm
for o in s.objects:                      # the shading normals the bake and the site use (bake.py step 1)
    if o.type == 'MESH' and 'grp' in o: o.data.set_sharp_from_angle(angle=math.radians(38))
for o in s.objects:                      # FX placeholders the browser replaces are hidden like in the bake
    if 'fx' in o and o.type == 'MESH' and o.get('fx') != 'screen': o.hide_render = True
cam = bpy.data.objects.new('Reference', bpy.data.cameras.new('Reference')); s.collection.objects.link(cam); s.camera = cam
cam.data.sensor_fit = 'VERTICAL'; cam.data.angle_y = math.radians(50); cam.data.clip_start = 0.02; cam.data.clip_end = 3000
B = lambda v: Vector((v[0], -v[2], v[1]))
os.makedirs(out, exist_ok=True)
for spec in specs:
    name, e, t = spec.split(':')[:3]
    e, t = B(list(map(float, e.split(',')))), B(list(map(float, t.split(','))))
    cam.location = e; cam.rotation_euler = (t - e).to_track_quat('-Z', 'Y').to_euler()
    exr = os.path.join(tempfile.gettempdir(), f'reference-{name}.exr'); s.render.filepath = exr; bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(exr); img.colorspace_settings.name = 'Non-Color'
    px = np.empty(w * h * 4, np.float32); img.pixels.foreach_get(px); bpy.data.images.remove(img)
    px = px.reshape(-1, 4); px[:, :3] = browser_look(np.nan_to_num(px[:, :3].astype(np.float64)))
    png = bpy.data.images.new('graded', w, h, alpha=False); png.colorspace_settings.name = 'Non-Color'; px[:, 3] = 1
    png.pixels.foreach_set(px.ravel()); png.filepath_raw = os.path.join(out, name + '.png'); png.file_format = 'PNG'; png.save(); bpy.data.images.remove(png)
    print('REFERENCE', name, flush=True)
