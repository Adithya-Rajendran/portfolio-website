# Path-traced reference still from the hero camera
import bpy, sys, os
a = sys.argv[sys.argv.index('--') + 1:]
out = a[0]; spp = int(a[1]) if len(a) > 1 else 96; w = int(a[2]) if len(a) > 2 else 960
s = bpy.context.scene
p = bpy.context.preferences.addons['cycles'].preferences
DEV = os.environ.get('LOBBY_DEVICE', 'CUDA')
p.compute_device_type = DEV; p.get_devices()
for d in p.devices: d.use = (d.type == DEV)
print('DEVICES', [(d.name, d.type) for d in p.devices if d.use], flush=True)
s.cycles.device = 'GPU'
s.cycles.samples = spp; s.cycles.use_denoising = True; s.cycles.denoiser = 'OPENIMAGEDENOISE'
s.cycles.sample_clamp_indirect = 12
s.render.resolution_x = w; s.render.resolution_y = int(w * 9 / 16); s.render.resolution_percentage = 100
if len(a) > 3:
    from mathutils import Vector
    v = [float(x) for x in a[3].split(',')]
    c = s.camera; c.location = v[:3]; c.rotation_euler = (Vector(v[3:]) - Vector(v[:3])).to_track_quat('-Z', 'Y').to_euler()
s.render.filepath = out; s.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
