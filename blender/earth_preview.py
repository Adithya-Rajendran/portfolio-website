"""Look-dev render of the view through the portal only.  blender -b lobby.blend --python earth_preview.py -- out.png [fov] [size]"""
import bpy, sys, os, math
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
s = bpy.context.scene; L = s['lobby'].to_dict()
for c in ('Lobby', 'FX'): bpy.data.collections[c].hide_render = True
p = bpy.context.preferences.addons['cycles'].preferences
DEV = os.environ.get('LOBBY_DEVICE', 'CUDA')
p.compute_device_type = DEV; p.get_devices()
for d in p.devices: d.use = (d.type == DEV)
s.cycles.device = 'GPU'; s.cycles.samples = 32; s.cycles.use_denoising = False
cam = s.camera; cam.data.angle_y = math.radians(float(a[1]) if len(a) > 1 else 36)
cam.location = L['cam']; cam.rotation_euler = (Vector(L['portal']) - Vector(L['cam'])).to_track_quat('-Z', 'Y').to_euler()
s.render.resolution_x = s.render.resolution_y = int(a[2]) if len(a) > 2 else 720
s.render.filepath = a[0]; s.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
