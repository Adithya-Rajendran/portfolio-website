"""Find what darkens a sunlit point in Cycles by bisection over render visibility (QA).
  blender -b room.blend -P sun_bisect.py -- x,y,z"""
import bpy, sys, math, os, tempfile
import numpy as np
from mathutils import Vector
p_ = Vector(map(float, sys.argv[sys.argv.index('--') + 1].split(',')))
s = bpy.context.scene
for o in s.objects:
    if o.type == 'LIGHT' and o.data.type != 'SUN': o.data.energy = 0
for w in bpy.data.worlds:
    for n in (w.node_tree.nodes if w.node_tree else []):
        if n.type == 'BACKGROUND': n.inputs['Strength'].default_value = 0
wm = bpy.data.materials.new('W'); wm.use_nodes = True; b = wm.node_tree.nodes['Principled BSDF']; b.inputs['Roughness'].default_value = 1; b.inputs['Specular IOR Level'].default_value = 0
bpy.context.view_layer.material_override = wm
s.render.engine = 'CYCLES'; s.cycles.samples = 16; s.cycles.max_bounces = 0; s.cycles.use_denoising = False
pr = bpy.context.preferences.addons['cycles'].preferences; pr.compute_device_type = os.environ.get('LOBBY_DEVICE', 'OPTIX'); pr.get_devices()
for d in pr.devices: d.use = d.type == pr.compute_device_type
s.cycles.device = 'GPU'; s.render.resolution_x = s.render.resolution_y = 4; s.render.resolution_percentage = 100
st = s.render.image_settings; st.file_format = 'OPEN_EXR'; st.color_depth = '32'; s.view_settings.view_transform = 'Standard'
cam = bpy.data.objects.new('Q', bpy.data.cameras.new('Q')); s.collection.objects.link(cam); s.camera = cam; cam.data.angle = math.radians(0.3)
cam.location = p_ + Vector((0, 0, 0.5)); cam.rotation_euler = (0, 0, 0)          # straight down onto the point
deps = bpy.context.evaluated_depsgraph_get()
hit, loc, nrm, idx, own, _ = s.ray_cast(deps, cam.location, Vector((0, 0, -1)), distance=2)
print('RECEIVER', own.name if hit else None, flush=True)
def lit():
    f = os.path.join(tempfile.gettempdir(), 'b.exr'); s.render.filepath = f; bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(f); v = float(np.array(im.pixels[:]).reshape(-1, 4)[:, 0].mean()); bpy.data.images.remove(im); return v
cands = [o for o in s.objects if o.type in ('MESH', 'CURVE', 'VOLUME', 'POINTCLOUD', 'CURVES', 'META', 'EMPTY') and not o.hide_render and o != own]
print('BASE radiance %.3f with %d candidates' % (lit(), len(cands)), flush=True)
while len(cands) > 1:
    half = cands[:len(cands) // 2]
    for o in half: o.hide_render = True
    v = lit()
    for o in half: o.hide_render = False
    cands = half if v > 0.05 else cands[len(cands) // 2:]
    print('  %d left (radiance with first half hidden %.3f)' % (len(cands), v), flush=True)
o = cands[0]; o.hide_render = True; v = lit()
print('OCCLUDER', o.name, o.type, [c.name for c in o.users_collection], 'radiance without it %.3f' % v, 'visible_shadow', o.visible_shadow, flush=True)
