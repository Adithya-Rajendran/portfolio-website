# Comparison of Cycles and ray_cast at single points
import bpy, sys, math, os, tempfile
import numpy as np
from mathutils import Vector
pts = [Vector(map(float, p.split(','))) for p in sys.argv[sys.argv.index('--') + 1:]]
s = bpy.context.scene
suns = [o for o in s.objects if o.type == 'LIGHT' and o.data.type == 'SUN']
print('SUNS', [(o.name, [c.name for c in o.users_collection], o.hide_render, tuple(round(v, 3) for v in (o.matrix_world.to_3x3() @ Vector((0, 0, 1))).normalized()), o.data.energy) for o in suns])
for o in s.objects:
    if o.type == 'LIGHT' and o.data.type != 'SUN': o.data.energy = 0
for w in bpy.data.worlds:
    for n in (w.node_tree.nodes if w.node_tree else []):
        if n.type == 'BACKGROUND': n.inputs['Strength'].default_value = 0
wm = bpy.data.materials.new('W'); wm.use_nodes = True; b = wm.node_tree.nodes['Principled BSDF']; b.inputs['Roughness'].default_value = 1; b.inputs['Specular IOR Level'].default_value = 0
bpy.context.view_layer.material_override = wm
s.render.engine = 'CYCLES'; s.cycles.samples = 64; s.cycles.max_bounces = 0; s.cycles.use_denoising = False
p = bpy.context.preferences.addons['cycles'].preferences; p.compute_device_type = os.environ.get('LOBBY_DEVICE', 'OPTIX'); p.get_devices()
for d in p.devices: d.use = d.type == p.compute_device_type
s.cycles.device = 'GPU'; s.render.resolution_x = s.render.resolution_y = 4; s.render.resolution_percentage = 100
st = s.render.image_settings; st.file_format = 'OPEN_EXR'; st.color_depth = '32'; s.view_settings.view_transform = 'Standard'
cam = bpy.data.objects.new('Q', bpy.data.cameras.new('Q')); s.collection.objects.link(cam); s.camera = cam; cam.data.angle = math.radians(0.5)
deps = bpy.context.evaluated_depsgraph_get(); d = (suns[0].matrix_world.to_3x3() @ Vector((0, 0, 1))).normalized()
for p_ in pts:
    cam.location = p_ + Vector((0, -0.6, 0.6)); cam.rotation_euler = (p_ - cam.location).to_track_quat('-Z', 'Y').to_euler()
    f = os.path.join(tempfile.gettempdir(), 'q.exr'); s.render.filepath = f; bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(f); v = np.array(im.pixels[:]).reshape(-1, 4)[:, 0].mean(); bpy.data.images.remove(im)
    hit, loc, _, _, obj, _ = s.ray_cast(deps, p_ + d * 1e-3, d, distance=300)
    print('POINT', tuple(p_), 'cycles radiance %.3f' % v, 'ray_cast', (obj.name if hit else 'clear'), flush=True)
