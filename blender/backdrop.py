# Render of the view through the portal (planet, rings, stars) to a backdrop image for three.js
import bpy, sys, os, math
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
size = int(a[0]) if a else 4096
HERE = os.path.dirname(os.path.abspath(__file__))
s = bpy.context.scene; L = s['lobby'].to_dict()
for c in ('Lobby', 'FX'): bpy.data.collections[c].hide_render = True
p = bpy.context.preferences.addons['cycles'].preferences
DEV = os.environ.get('LOBBY_DEVICE', 'CUDA')
p.compute_device_type = DEV; p.get_devices()
for d in p.devices: d.use = (d.type == DEV)
print('DEVICES', [(d.name, d.type) for d in p.devices if d.use], flush=True)
s.cycles.device = 'GPU'; s.cycles.samples = 128; s.cycles.use_denoising = False
cam = s.camera; cam.data.sensor_fit = 'VERTICAL'; cam.data.angle_y = math.radians(L.get('backdrop_fov', 80))
cam.location = L['cam']
aim = Vector(L['spin']['axis']) if 'spin' in L else Vector(L['portal']) - Vector(L['cam'])
cam.rotation_euler = aim.to_track_quat('-Z', 'Y').to_euler()
s.render.resolution_x = s.render.resolution_y = size; s.render.resolution_percentage = 100
s.render.image_settings.file_format = 'OPEN_EXR'; s.render.image_settings.color_depth = '32'
import tempfile
tmp = os.path.join(tempfile.gettempdir(), 'lobby_backdrop.exr'); s.render.filepath = tmp
bpy.ops.render.render(write_still=True)
import numpy as np
R = s['lobby'].to_dict().get('hdr_range', 8.0) if False else 8.0
img = bpy.data.images.load(tmp); w, h = img.size
px = np.empty(w * h * 4, dtype=np.float32); img.pixels.foreach_get(px); px = np.nan_to_num(px.reshape(-1, 4))
buf = np.ones((w * h, 4), np.float32); buf[:, :3] = np.sqrt(np.clip(px[:, :3], 0, R) / R)
out = bpy.data.images.new('enc', w, h, alpha=False, float_buffer=False); out.colorspace_settings.name = 'Non-Color'
out.pixels.foreach_set(buf.ravel())
ROOM = L.get('room', 'lobby')
OUTT = os.path.join(HERE, '..', 'assets-src', ROOM, 'tex'); os.makedirs(OUTT, exist_ok=True)
out.filepath_raw = os.path.join(OUTT, 'backdrop.webp'); out.file_format = 'WEBP'; out.save(quality=94)
print('BACKDROP saved')
