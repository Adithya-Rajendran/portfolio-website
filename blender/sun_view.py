"""What the sun sees at the dais (QA): orthographic Cycles render along the sun direction. blender -b room.blend -P sun_view.py -- out.png cx,cy,cz scale"""
import bpy, sys, math
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]; out = a[0]; c = Vector(map(float, a[1].split(','))); sc = float(a[2])
s = bpy.context.scene; sun = next(o for o in s.objects if o.type == 'LIGHT' and o.data.type == 'SUN')
d = (sun.matrix_world.to_3x3() @ Vector((0, 0, 1))).normalized()
cam = bpy.data.objects.new('SunEye', bpy.data.cameras.new('SunEye')); s.collection.objects.link(cam); s.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = sc; cam.data.clip_start = 0.1; cam.data.clip_end = 500
cam.location = c + d * 80; cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
s.render.engine = 'CYCLES'; s.cycles.samples = 16; s.cycles.use_denoising = False; s.render.resolution_x = s.render.resolution_y = 512
s.view_settings.view_transform = 'Standard'; s.render.image_settings.file_format = 'PNG'; s.render.filepath = out
import os; p = bpy.context.preferences.addons['cycles'].preferences; p.compute_device_type = os.environ.get('LOBBY_DEVICE', 'OPTIX'); p.get_devices()
for dv in p.devices: dv.use = dv.type == p.compute_device_type
s.cycles.device = 'GPU'
wm = bpy.data.materials.new('W'); wm.use_nodes = True; bpy.context.view_layer.material_override = wm
for w in bpy.data.worlds:
    for n in (w.node_tree.nodes if w.node_tree else []):
        if n.type == 'BACKGROUND': n.inputs['Strength'].default_value = 1.0; n.inputs['Color'].default_value = (0.2, 0.4, 1, 1)
bpy.ops.render.render(write_still=True); print('SUNVIEW', out, flush=True)
