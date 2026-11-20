"""Small data textures for the holographic globe, derived from the NASA maps.   blender -b --python landmask.py
   -> public/assets/lobby/tex/landmask.png   (512x256, land = white)
   -> public/assets/lobby/tex/citylights.png (1024x512, brightness of night lights)"""
import bpy, os, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets-src', 'lobby', 'tex')

def load(name):
    img = bpy.data.images.load(os.path.join(HERE, 'textures_dl', name)); w, h = img.size
    px = np.empty(w * h * 4, np.float32); img.pixels.foreach_get(px); px = px.reshape(h, w, 4)
    bpy.data.images.remove(img)
    return px

def shrink(px, W, H):
    h, w = px.shape[:2]
    return px[:h // H * H, :w // W * W].reshape(H, h // H, W, w // W, 4).mean(axis=(1, 3))

def save(gray, name):
    H, W = gray.shape
    out = bpy.data.images.new(name, W, H, alpha=False); out.colorspace_settings.name = 'Non-Color'
    buf = np.ones((H, W, 4), np.float32); buf[..., :3] = gray[..., None]
    out.pixels.foreach_set(buf.ravel()); out.filepath_raw = os.path.join(OUT, name); out.file_format = 'PNG'; out.save()

d = shrink(load('day.jpg'), 512, 256)
r, g, b = d[..., 0], d[..., 1], d[..., 2]
land = ~((b > r * 1.25) & (b > g * 1.02))          # ocean is the only strongly blue thing; ice and desert count as land
save(land.astype(np.float32), 'landmask.png')

hi = os.path.join(HERE, 'textures_dl', 'night_hi.jpg')
n = shrink(load('night_hi.jpg' if os.path.exists(hi) else 'night.jpg'), 1024, 512)
lum = n[..., :3].max(axis=2)
lum = np.clip((lum - 0.1) / 0.6, 0, 1) ** 1.5      # drop the map's grey base, keep real lights
save(lum, 'citylights.png')
print('LAND', land.mean(), 'LIT', (lum > 0.15).mean())
